import { requireAdmin } from './_utils';

function getDefaultSheetState() {
  return {
    teams: [
      { teamName: '1팀', players: ['', '', '', ''], minusScores: ['-2', '-1.5', '-1', '-0.5'] },
      { teamName: '2팀', players: ['', '', '', ''], minusScores: ['0', '0', '0', '0'] },
      { teamName: '3팀', players: ['', '', '', ''], minusScores: ['0', '0', '0', '0'] },
      { teamName: '4팀', players: ['', '', '', ''], minusScores: ['0', '0', '0', '0'] },
      { teamName: '5팀', players: ['', '', '', ''], minusScores: ['0', '0', '0', '0'] }
    ],
    rounds: Array.from({ length: 30 }, (_, index) => ({
      round: index + 1,
      map: '사녹',
      teams: Array.from({ length: 5 }, () => ({
        top10: false,
        chicken: false,
        players: Array.from({ length: 4 }, () => ({
          kill: ''
        }))
      }))
    }))
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const denied = requireAdmin(request);
    if (denied) {
      return denied;
    }

    const data = getDefaultSheetState();

    await env.DB.prepare(`
      INSERT INTO sheet_state (id, data, updated_at)
      VALUES (1, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `).bind(JSON.stringify(data)).run();

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
