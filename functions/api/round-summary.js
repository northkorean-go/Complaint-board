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
    const openRound = await getOpenRound(env);
    const latestRound = await getLatestRound(env);

    let targetRound = null;
    let items = [];

    if (openRound) {
      const openItems = await getRoundRecords(env, openRound.id);

      if (openItems.length > 0) {
        targetRound = openRound;
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
            targetRound = latestClosedRound;
            items = closedItems;
          } else {
            targetRound = openRound;
            items = openItems;
          }
        } else {
          targetRound = openRound;
          items = openItems;
        }
      }
    } else if (latestRound) {
      targetRound = latestRound;
      items = await getRoundRecords(env, latestRound.id);
    }

    if (!targetRound) {
      return json({
        ok: true,
        round: null,
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
      round: {
        id: targetRound.id,
        name: targetRound.name,
        is_open: Number(targetRound.is_open) === 1,
        started_at: targetRound.started_at,
        ended_at: targetRound.ended_at,
      },
      roundRecords: items,
      ranking,
      mvpRanking,
      benefitText: targetRound.benefit_text || "",
      nextScheduleText: targetRound.next_schedule_text || "미정",
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
