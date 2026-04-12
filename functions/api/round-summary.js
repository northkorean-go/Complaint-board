import { json, getOpenRound, getLatestRound } from './_utils.js';

function sortCountItems(items) {
  return items.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(a.name).localeCompare(String(b.name), 'ko');
  });
}

function parseMembers(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(v => String(v || '').trim()).filter(Boolean);
  }

  const text = String(value).trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map(v => String(v || '').trim()).filter(Boolean);
    }
  } catch (e) {
    // ignore
  }

  return text
    .split(/[,\n/|]/)
    .map(v => String(v || '').trim())
    .filter(Boolean);
}

export async function onRequestGet(context) {
  const { env } = context;

  try {
    let round = await getOpenRound(env);
    if (!round) {
      round = await getLatestRound(env);
    }

    if (!round) {
      return json({
        ok: true,
        round: null,
        roundRecords: [],
        ranking: [],
        mvpRanking: [],
        benefitText: '',
        nextScheduleText: '미정',
      });
    }

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
      .bind(round.id)
      .all();

    const items = (result.results || []).map((row) => {
      const members = parseMembers(row.winner_members_json);
      return {
        ...row,
        winner_members_json: JSON.stringify(members),
        winner_members: members,
      };
    });

    const winnerCounts = {};
    const mvpCounts = {};

    for (const item of items) {
      const members = Array.isArray(item.winner_members)
        ? item.winner_members
        : parseMembers(item.winner_members_json);

      for (const member of members) {
        const name = String(member || '').trim();
        if (!name) continue;
        winnerCounts[name] = (winnerCounts[name] || 0) + 1;
      }

      const mvpName = String(item.mvp_name || '').trim();
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
        id: round.id,
        name: round.name,
        is_open: !!round.is_open,
      },
      roundRecords: items,
      ranking,
      mvpRanking,
      benefitText: round.benefit_text || '',
      nextScheduleText: round.next_schedule_text || '미정',
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || '회차 집계 조회 실패',
      },
      500
    );
  }
}
