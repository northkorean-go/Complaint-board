import { json, getOpenRound, getLatestRound } from "./_utils.js";

function sortCountItems(items) {
  return items.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(a.name).localeCompare(String(b.name), "ko");
  });
}

function parseMembers(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean);
  }

  const text = String(value).trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v || "").trim()).filter(Boolean);
    }
  } catch (e) {
    // ignore
  }

  return text
    .split(/[,\n/|]/)
    .map((v) => String(v || "").trim())
    .filter(Boolean);
}

function normalizeRound(round) {
  if (!round) return null;

  return {
    id: round.id,
    name: round.name,
    is_open: Number(round.is_open) === 1,
    started_at: round.started_at,
    ended_at: round.ended_at,
    benefit_text: round.benefit_text || "",
    next_schedule_text: round.next_schedule_text || "미정",
  };
}

function parseSummaryTeamEntries(summaryText) {
  const entries = [];
  const regex = /([^\s:\]]+?)팀\s*(-?\d+(?:\.\d+)?)/g;
  let match;

  while ((match = regex.exec(String(summaryText || ""))) !== null) {
    entries.push({
      teamName: match[1].trim() + "팀",
      baseName: match[1].trim(),
      score: parseFloat(match[2]),
    });
  }

  return entries;
}

function extractPlayerInfoFromCell(cellText) {
  const text = String(cellText || "").trim();
  if (!text) return null;
  if (text.includes("정지") || text.includes("치킨")) return null;
  if (/^0\s*\(/.test(text)) return null;

  const match = text.match(/^([^\d]+?)\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const name = match[1].trim();
  const score = parseFloat(match[2]);

  if (!name || Number.isNaN(score)) return null;

  return { name, score };
}

async function getRoundRecords(env, roundId) {
  const result = await env.DB.prepare(`
    SELECT
      id,
      round_id,
      match_date,
      match_date_text,
      title,
      summary_text,
      winner_team,
      winner_score,
      winner_members_json,
      mvp_name,
      mvp_score,
      created_at
    FROM match_results
    WHERE round_id = ?
    ORDER BY match_date DESC, id DESC
  `)
    .bind(roundId)
    .all();

  return (result.results || []).map((row) => {
    const members = parseMembers(row.winner_members_json);
    return {
      ...row,
      winner_members: members,
      winner_members_json: JSON.stringify(members),
    };
  });
}

async function getMatchRows(env, resultId) {
  const result = await env.DB.prepare(`
    SELECT row_no, col1, col2, col3, col4, col5
    FROM match_rows
    WHERE result_id = ?
    ORDER BY row_no ASC
  `)
    .bind(resultId)
    .all();

  return result.results || [];
}

async function buildAutoBenefitText(env, latestMatch) {
  if (!latestMatch) return "미설정";

  const teams = parseSummaryTeamEntries(latestMatch.summary_text || "");
  if (!teams.length) return latestMatch.match_date_text || "-";

  let lowestTeam = teams[0];
  for (let i = 1; i < teams.length; i++) {
    if (teams[i].score < lowestTeam.score) {
      lowestTeam = teams[i];
    }
  }

  const rows = await getMatchRows(env, latestMatch.id);
  if (!rows.length) return latestMatch.match_date_text || "-";

  const teamIndex = teams.findIndex((team) => team.baseName === lowestTeam.baseName);
  if (teamIndex === -1) return latestMatch.match_date_text || "-";

  const colKey = ["col1", "col2", "col3", "col4", "col5"][teamIndex];
  if (!colKey) return latestMatch.match_date_text || "-";

  let lowestPlayer = null;

  for (const row of rows) {
    const player = extractPlayerInfoFromCell(row[colKey]);
    if (!player) continue;

    if (!lowestPlayer || player.score < lowestPlayer.score) {
      lowestPlayer = player;
    }
  }

  if (!lowestPlayer) return latestMatch.match_date_text || "-";

  return `${latestMatch.match_date_text || "-"} ${lowestPlayer.name}`;
}

function getKoreaNowDate() {
  const now = new Date();
  const koreaText = now.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
  return new Date(koreaText.replace(" ", "T"));
}

function formatScheduleLine(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekNames = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekNames[date.getDay()];
  return `${month}.${day} (${weekday}) 22:00`;
}

function getUpcomingTargetDates(baseDate) {
  const targets = [4, 6];
  const result = [];

  for (const targetDay of targets) {
    const date = new Date(baseDate);
    date.setHours(22, 0, 0, 0);

    let diff = targetDay - date.getDay();
    if (diff < 0) diff += 7;

    date.setDate(date.getDate() + diff);

    if (diff === 0 && baseDate >= date) {
      date.setDate(date.getDate() + 7);
    }

    result.push(date);
  }

  result.sort((a, b) => a - b);
  return result;
}

function buildAutoNextScheduleItems(currentRound) {
  const nowKorea = getKoreaNowDate();
  const upcoming = getUpcomingTargetDates(nowKorea);
  return upcoming.map(formatScheduleLine);
}

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const openRoundRaw = await getOpenRound(env);
    const latestRoundRaw = await getLatestRound(env);

    const currentRound = normalizeRound(openRoundRaw || latestRoundRaw || null);

    let summaryRoundRaw = null;
    let items = [];

    if (openRoundRaw) {
      const openItems = await getRoundRecords(env, openRoundRaw.id);

      if (openItems.length > 0) {
        summaryRoundRaw = openRoundRaw;
        items = openItems;
      } else {
        const latestClosedRound = await env.DB.prepare(`
          SELECT *
          FROM rounds
          WHERE is_open = 0
          ORDER BY id DESC
          LIMIT 1
        `).first();

        if (latestClosedRound) {
          const closedItems = await getRoundRecords(env, latestClosedRound.id);

          if (closedItems.length > 0) {
            summaryRoundRaw = latestClosedRound;
            items = closedItems;
          } else {
            summaryRoundRaw = openRoundRaw;
            items = openItems;
          }
        } else {
          summaryRoundRaw = openRoundRaw;
          items = openItems;
        }
      }
    } else if (latestRoundRaw) {
      summaryRoundRaw = latestRoundRaw;
      items = await getRoundRecords(env, latestRoundRaw.id);
    }

    const summaryRound = normalizeRound(summaryRoundRaw);

    if (!summaryRound && !currentRound) {
      return json({
        ok: true,
        round: null,
        currentRound: null,
        summaryRound: null,
        roundRecords: [],
        ranking: [],
        mvpRanking: [],
        benefitText: "미설정",
        nextScheduleText: "미정",
        nextScheduleItems: [],
      });
    }

    const winnerCounts = {};
    const mvpCounts = {};

    for (const item of items) {
      for (const member of item.winner_members || []) {
        const name = String(member || "").trim();
        if (!name) continue;
        winnerCounts[name] = (winnerCounts[name] || 0) + 1;
      }

      const mvpName = String(item.mvp_name || "").trim();
      if (mvpName) {
        mvpCounts[mvpName] = (mvpCounts[mvpName] || 0) + 1;
      }
    }

    const ranking = sortCountItems(
      Object.keys(winnerCounts).map((name) => ({
        name,
        count: winnerCounts[name],
      }))
    );

    const mvpRanking = sortCountItems(
      Object.keys(mvpCounts).map((name) => ({
        name,
        count: mvpCounts[name],
      }))
    );

    const latestMatch = items.length ? items[0] : null;
    const autoBenefitText = await buildAutoBenefitText(env, latestMatch);
    const nextScheduleItems = buildAutoNextScheduleItems(currentRound);
    const nextScheduleText = nextScheduleItems.length
      ? nextScheduleItems.join(" / ")
      : (summaryRound?.next_schedule_text || "미정");

    return json({
      ok: true,
      round: currentRound,
      currentRound,
      summaryRound,
      roundRecords: items,
      ranking,
      mvpRanking,
      benefitText: autoBenefitText,
      nextScheduleText,
      nextScheduleItems,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "회차 집계 조회 실패",
      },
      500
    );
  }
}
