import { json, serverError, getOpenRound } from './_utils';

function sortCountItems(items) {
  return items.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(a.name).localeCompare(String(b.name), 'ko');
  });
}

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const round = await getOpenRound(env);

    if (!round) {
      return json({
        ok: true,
        round: null,
        ranking: [],
        mvpRanking: [],
        benefitText: '',
        nextScheduleText: '미정',
      });
    }

    const matchRows = await env.DB.prepare(`
      SELECT winner_members_json, mvp_name
      FROM match_results
      WHERE round_id = ?
      ORDER BY match_date DESC, id DESC
    `)
      .bind(round.id)
      .all();

    const winnerCounts = Object.create(null);
    const mvpCounts = Object.create(null);

    for (const row of matchRows.results || []) {
      let members = [];
      try {
        members = JSON.parse(row.winner_members_json || '[]');
      } catch {
        members = [];
      }

      for (const name of members) {
        const key = String(name || '').trim();
        if (!key) continue;
        winnerCounts[key] = (winnerCounts[key] || 0) + 1;
      }

      const mvpName = String(row.mvp_name || '').trim();
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
      ranking,
      mvpRanking,
      benefitText: round.benefit_text || '',
      nextScheduleText: round.next_schedule_text || '미정',
    });
  } catch (error) {
    return serverError(error);
  }
}
