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

async function readSheetState(env) {
  const row = await env.DB.prepare(`
    SELECT data FROM sheet_state WHERE id = 1
  `).first();

  if (!row || !row.data) {
    return getDefaultSheetState();
  }

  try {
    return JSON.parse(row.data);
  } catch {
    return getDefaultSheetState();
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const patch = await request.json();
    const data = await readSheetState(env);

    if (patch.type === 'playerName') {
      const { teamIndex, playerIndex, value } = patch;
      data.teams[teamIndex].players[playerIndex] = String(value || '');
    }

    else if (patch.type === 'minusScore') {
      const { teamIndex, playerIndex, value } = patch;
      data.teams[teamIndex].minusScores[playerIndex] = String(value ?? '0');
    }

    else if (patch.type === 'map') {
      const { roundIndex, value } = patch;
      data.rounds[roundIndex].map = String(value || '');
    }

    else if (patch.type === 'kill') {
      const { roundIndex, teamIndex, playerIndex, value } = patch;
      data.rounds[roundIndex].teams[teamIndex].players[playerIndex].kill = String(value || '');
    }

    else if (patch.type === 'top10') {
      const { roundIndex, teamIndex, value } = patch;
      data.rounds[roundIndex].teams[teamIndex].top10 = !!value;
    }

    else if (patch.type === 'chicken') {
      const { roundIndex, teamIndex, value } = patch;
      data.rounds[roundIndex].teams[teamIndex].chicken = !!value;
    }

    else {
      return new Response(JSON.stringify({ ok: false, error: 'unknown patch type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await env.DB.prepare(`
      INSERT INTO sheet_state (id, data, updated_at)
      VALUES (1, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `).bind(JSON.stringify(data)).run();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
