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
  } catch (e) {}

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
        benefitText: "",
        nextScheduleText: "미정",
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

    return json({
      ok: true,

      /* 하위 호환용 */
      round: currentRound,

      /* 새로 분리 */
      currentRound,
      summaryRound,

      roundRecords: items,
      ranking,
      mvpRanking,

      benefitText: summaryRound?.benefit_text || "",
      nextScheduleText: summaryRound?.next_schedule_text || "미정",
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
