import {
  json,
  getKoreaNowString,
  getOpenRound,
  requireAdmin,
} from "./_utils.js";

function corsHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function withCors(response) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders();
  Object.keys(cors).forEach((key) => headers.set(key, cors[key]));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function getKoreaNowDate() {
  const now = new Date();
  const koreaText = now.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
  return new Date(koreaText.replace(" ", "T"));
}

function getMatchDates() {
  const korea = getKoreaNowDate();
  const hour = korea.getHours();
  const base = new Date(korea.getFullYear(), korea.getMonth(), korea.getDate());

  if (hour < 6) {
    base.setDate(base.getDate() - 1);
  }

  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");

  return {
    storageDate: `${yyyy}-${mm}-${dd}`,
    displayDate: `${mm}.${dd}`,
  };
}

function getPlayerTotals(sheetState, roundCount, teamIndex, playerIndex) {
  let kill = 0;
  let top10 = 0;

  for (let r = 0; r < roundCount; r++) {
    const player = sheetState?.rounds?.[r]?.teams?.[teamIndex]?.players?.[playerIndex];
    kill += Number(player?.kill || 0);
    if (player?.top10) top10 += 1;
  }

  return {
    kill,
    top10,
    pure: kill - top10,
    score: kill + top10,
  };
}

function getTeamTotals(sheetState, roundCount, playersPerTeam, teamIndex) {
  let score = 0;
  let pure = 0;

  for (let p = 0; p < playersPerTeam; p++) {
    const totals = getPlayerTotals(sheetState, roundCount, teamIndex, p);
    score += totals.score;
    pure += totals.pure;
  }

  return { score, pure };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  if (request.method !== "POST" && request.method !== "GET") {
    return withCors(json({ ok: false, error: "Method not allowed" }, 405));
  }

  const adminDenied = requireAdmin(request);
  if (adminDenied) {
    return withCors(adminDenied);
  }

  try {
    const round = await getOpenRound(env);

    if (!round) {
      return withCors(
        json(
          {
            ok: false,
            error: "열린 회차가 없습니다. 관리자 페이지에서 먼저 회차를 오픈해주세요.",
          },
          400
        )
      );
    }

    const sheetRow = await env.DB.prepare(
      `SELECT data FROM sheet_state WHERE id = 1 LIMIT 1`
    ).first();

    if (!sheetRow?.data) {
      return withCors(
        json(
          {
            ok: false,
            error: "입력표 데이터가 없습니다. 내전입력표를 먼저 입력해주세요.",
          },
          400
        )
      );
    }

    const sheetState = JSON.parse(sheetRow.data);

    const TEAM_COUNT = Array.isArray(sheetState?.teams) ? sheetState.teams.length : 0;
    const ROUND_COUNT = Array.isArray(sheetState?.rounds) ? sheetState.rounds.length : 0;
    const PLAYERS_PER_TEAM =
      sheetState?.teams?.[0]?.players?.length ||
      sheetState?.rounds?.[0]?.teams?.[0]?.players?.length ||
      4;

    if (!TEAM_COUNT || !ROUND_COUNT) {
      return withCors(
        json(
          {
            ok: false,
            error: "입력표 데이터 구조가 올바르지 않습니다.",
          },
          400
        )
      );
    }

    const teams = [];

    for (let i = 0; i < TEAM_COUNT; i++) {
      const teamName = sheetState.teams?.[i]?.teamName || `${i + 1}팀`;
      const members = Array.isArray(sheetState.teams?.[i]?.players)
        ? sheetState.teams[i].players
        : [];

      const totals = getTeamTotals(sheetState, ROUND_COUNT, PLAYERS_PER_TEAM, i);

      teams.push({
        teamIndex: i,
        teamName,
        score: totals.score,
        pure: totals.pure,
        members,
      });
    }

    teams.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.pure !== a.pure) return b.pure - a.pure;
      return a.teamIndex - b.teamIndex;
    });

    const winner = teams[0] || {
      teamName: "",
      score: null,
      members: [],
    };

    const players = [];

    for (let t = 0; t < TEAM_COUNT; t++) {
      for (let p = 0; p < PLAYERS_PER_TEAM; p++) {
        const name =
          sheetState?.teams?.[t]?.players?.[p] || `선수${p + 1}`;
        const totals = getPlayerTotals(sheetState, ROUND_COUNT, t, p);

        players.push({
          name,
          score: totals.score,
          pure: totals.pure,
          kill: totals.kill,
          top10: totals.top10,
        });
      }
    }

    players.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.pure !== a.pure) return b.pure - a.pure;
      return String(a.name).localeCompare(String(b.name), "ko");
    });

    const mvp = players[0] || null;
    const { storageDate, displayDate } = getMatchDates();

    const summaryText =
      "[" + teams.reduce((sum, t) => sum + t.score, 0) + "] " +
      teams.map((t) => `${t.teamName} ${t.score}`).join(" : ");

    const snapshotKey = `${round.id}|${storageDate}|${summaryText}`;
    const createdAtKST = getKoreaNowString();

    const exists = await env.DB.prepare(
      `SELECT id FROM match_results WHERE snapshot_key = ? LIMIT 1`
    )
      .bind(snapshotKey)
      .first();

    if (exists) {
      return withCors(
        json({
          ok: true,
          saved: false,
          message: "이미 저장된 내전 결과입니다.",
          id: exists.id,
          round_id: round.id,
          round_name: round.name,
        })
      );
    }

    const insertResult = await env.DB.prepare(`
      INSERT INTO match_results (
        round_id,
        snapshot_key,
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        round.id,
        snapshotKey,
        storageDate,
        displayDate,
        "최근 내전 결과",
        summaryText,
        winner.teamName || "",
        winner.score ?? null,
        JSON.stringify(winner.members || []),
        mvp ? mvp.name : "",
        mvp ? mvp.score : null,
        createdAtKST
      )
      .run();

    const resultId = insertResult.meta?.last_row_id;
    if (!resultId) {
      return withCors(
        json({ ok: false, error: "결과 저장 후 ID를 가져오지 못했습니다." }, 500)
      );
    }

    const rowStatements = [];

    for (let p = 0; p < PLAYERS_PER_TEAM; p++) {
      const row = [];

      for (let i = 0; i < teams.length; i++) {
        const teamIndex = teams[i].teamIndex;
        const name = sheetState?.teams?.[teamIndex]?.players?.[p] || "";
        const totals = getPlayerTotals(sheetState, ROUND_COUNT, teamIndex, p);

        row.push(name ? `${name}\n${totals.score} (${totals.kill}-${totals.top10})` : "");
      }

      rowStatements.push(
        env.DB.prepare(`
          INSERT INTO match_rows (
            result_id, row_no, col1, col2, col3, col4, col5
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          resultId,
          p + 1,
          row[0] || "",
          row[1] || "",
          row[2] || "",
          row[3] || "",
          row[4] || ""
        )
      );
    }

    if (rowStatements.length) {
      await env.DB.batch(rowStatements);
    }

    return withCors(
      json({
        ok: true,
        saved: true,
        id: resultId,
        round_id: round.id,
        round_name: round.name,
        match_date: displayDate,
        winner_team: winner.teamName || "",
        winner_score: winner.score ?? null,
        winner_members: winner.members || [],
        mvp_name: mvp ? mvp.name : "",
        mvp_score: mvp ? mvp.score : null,
        created_at: createdAtKST,
      })
    );
  } catch (error) {
    return withCors(
      json(
        {
          ok: false,
          error: error.message || "저장 중 오류가 발생했습니다.",
        },
        500
      )
    );
  }
}
