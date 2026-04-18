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

function safeIndex(index, max) {
  return Number.isInteger(index) && index >= 0 && index < max;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const patch = await request.json();
    const data = await readSheetState(env);

    if (!patch || typeof patch !== 'object') {
      return new Response(JSON.stringify({ ok: false, error: 'invalid patch' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const {
      type,
      teamIndex,
      playerIndex,
      roundIndex,
      value
    } = patch;

    /* ======================
       PLAYER NAME
    ====================== */
    if (type === 'playerName') {
      if (!safeIndex(teamIndex, 5) || !safeIndex(playerIndex, 4)) {
        throw new Error('invalid playerName index');
      }

      data.teams[teamIndex].players[playerIndex] = String(value || '');
    }

    /* ======================
       MINUS (🔥 중요)
    ====================== */
    else if (type === 'minus') {
      if (!safeIndex(teamIndex, 5) || !safeIndex(playerIndex, 4)) {
        throw new Error('invalid minus index');
      }

      data.teams[teamIndex].minusScores[playerIndex] = String(value ?? '0');
    }

    /* ======================
       MAP
    ====================== */
    else if (type === 'map') {
      if (!safeIndex(roundIndex, 30)) {
        throw new Error('invalid map index');
      }

      data.rounds[roundIndex].map = String(value || '');
    }

    /* ======================
       KILL
    ====================== */
    else if (type === 'kill') {
      if (
        !safeIndex(roundIndex, 30) ||
        !safeIndex(teamIndex, 5) ||
        !safeIndex(playerIndex, 4)
      ) {
        throw new Error('invalid kill index');
      }

      const v = String(value || '').trim();

      // 숫자 아닌 값 방지
      if (v !== '' && !/^\d+$/.test(v)) {
        throw new Error('invalid kill value');
      }

      data.rounds[roundIndex].teams[teamIndex].players[playerIndex].kill = v;
    }

    /* ======================
       TOP10
    ====================== */
    else if (type === 'top10') {
      if (!safeIndex(roundIndex, 30) || !safeIndex(teamIndex, 5)) {
        throw new Error('invalid top10 index');
      }

      data.rounds[roundIndex].teams[teamIndex].top10 = !!value;
    }

    /* ======================
       CHICKEN
    ====================== */
    else if (type === 'chicken') {
      if (!safeIndex(roundIndex, 30) || !safeIndex(teamIndex, 5)) {
        throw new Error('invalid chicken index');
      }

      data.rounds[roundIndex].teams[teamIndex].chicken = !!value;
    }

    /* ======================
       UNKNOWN TYPE
    ====================== */
    else {
      return new Response(JSON.stringify({
        ok: false,
        error: 'unknown patch type',
        received: type
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    /* ======================
       SAVE
    ====================== */
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
    return new Response(JSON.stringify({
      ok: false,
      error: e.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
