export async function onRequestPost(context) {
  const { env } = context;

  try {
    // 1. 현재 입력표 가져오기
    const sheetRow = await env.DB.prepare(`
      SELECT data FROM sheet_state WHERE id = 1
    `).first();

    if (!sheetRow) {
      return new Response(JSON.stringify({
        ok: false,
        error: '입력표 데이터 없음'
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    const sheetState = JSON.parse(sheetRow.data);

    const TEAM_COUNT = 5;
    const PLAYERS_PER_TEAM = 4;
    const ROUND_COUNT = sheetState.rounds.length;

    // 2. 유틸 함수
    function getPlayerTotals(teamIndex, playerIndex) {
      let kill = 0;
      let top10 = 0;

      for (let r = 0; r < ROUND_COUNT; r++) {
        const p = sheetState.rounds[r].teams[teamIndex].players[playerIndex];
        kill += Number(p.kill || 0);
        if (p.top10) top10 += 1;
      }

      return {
        kill,
        top10,
        pure: kill - top10,
        score: kill + top10
      };
    }

    function getTeamTotals(teamIndex) {
      let score = 0;
      let pure = 0;

      for (let p = 0; p < PLAYERS_PER_TEAM; p++) {
        const t = getPlayerTotals(teamIndex, p);
        score += t.score;
        pure += t.pure;
      }

      return { score, pure };
    }

    // 3. 팀 정렬 (1등팀)
    const teams = [];

    for (let i = 0; i < TEAM_COUNT; i++) {
      const totals = getTeamTotals(i);

      teams.push({
        teamIndex: i,
        teamName: sheetState.teams[i].teamName,
        score: totals.score,
        pure: totals.pure,
        members: sheetState.teams[i].players
      });
    }

    teams.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.pure !== a.pure) return b.pure - a.pure;
      return a.teamIndex - b.teamIndex;
    });

    const winner = teams[0];

    // 4. MVP
    const players = [];

    for (let t = 0; t < TEAM_COUNT; t++) {
      for (let p = 0; p < PLAYERS_PER_TEAM; p++) {
        const totals = getPlayerTotals(t, p);

        players.push({
          name: sheetState.teams[t].players[p],
          score: totals.score,
          pure: totals.pure
        });
      }
    }

    players.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.pure !== a.pure) return b.pure - a.pure;
      return a.name.localeCompare(b.name, 'ko');
    });

    const mvp = players[0];

    // 5. 날짜
    const now = new Date();
    const match_date = now.toISOString().slice(0, 10);

    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const match_date_text = `${month}.${day}`;

    const snapshot_key = match_date + '-' + Date.now();

    // 6. summary 텍스트
    const summary_text =
      '[' + teams.reduce((sum, t) => sum + t.score, 0) + '] ' +
      teams.map(t => `${t.teamName} ${t.score}`).join(' : ');

    // 7. 결과 저장
    const result = await env.DB.prepare(`
      INSERT INTO match_results (
        snapshot_key,
        match_date,
        match_date_text,
        summary_text,
        winner_team,
        winner_score,
        winner_members_json,
        mvp_name,
        mvp_score
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      snapshot_key,
      match_date,
      match_date_text,
      summary_text,
      winner.teamName,
      winner.score,
      JSON.stringify(winner.members),
      mvp.name,
      mvp.score
    ).run();

    const result_id = result.meta.last_row_id;

    // 8. 표 저장 (match_rows)
    let rowNo = 1;

    for (let p = 0; p < PLAYERS_PER_TEAM; p++) {
      const row = [];

      for (let i = 0; i < teams.length; i++) {
        const teamIndex = teams[i].teamIndex;
        const name = sheetState.teams[teamIndex].players[p];
        const totals = getPlayerTotals(teamIndex, p);

        row.push(`${name}\n${totals.score} (${totals.kill}-${totals.top10})`);
      }

      await env.DB.prepare(`
        INSERT INTO match_rows (result_id, row_no, col1, col2, col3, col4, col5)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        result_id,
        rowNo++,
        row[0] || '',
        row[1] || '',
        row[2] || '',
        row[3] || '',
        row[4] || ''
      ).run();
    }

    return new Response(JSON.stringify({
      ok: true,
      saved: true,
      match_date,
      round_name: null
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({
      ok: false,
      error: e.message
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
