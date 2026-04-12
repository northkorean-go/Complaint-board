import {
  json,
  parseCSV,
  buildTopTeamText,
  findRecentDetailedMatch,
  parseTopTeamInfo,
  findWinningTeamMembers,
  findMVPPlayer,
  normalizeDisplayDate,
  normalizeStorageDate,
  getKoreaNowString,
  ensureOpenRound,
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
    const CSV_URL =
      "https://docs.google.com/spreadsheets/d/1gvrn7SDzU7kjtXwmiJjN6Xf9HSsCDuYOo9rajIKnC7c/export?format=csv&gid=0";

    const mainRes = await fetch(CSV_URL, {
      cf: { cacheTtl: 0, cacheEverything: false },
    });

    if (!mainRes.ok) {
      return withCors(
        json(
          { ok: false, error: "메인 시트 로드 실패", status: mainRes.status },
          500
        )
      );
    }

    const csvText = await mainRes.text();
    const rows = parseCSV(csvText);

    const topTeamText = buildTopTeamText(rows) || "";
    const recentMatch = findRecentDetailedMatch(rows);
    const topTeamInfo = parseTopTeamInfo(topTeamText);
    const winnerMembers = findWinningTeamMembers(rows, topTeamText);
    const mvp = findMVPPlayer(rows);

    if (!recentMatch) {
      return withCors(
        json({ ok: false, error: "최근 내전 결과를 찾지 못했습니다." }, 400)
      );
    }

    const displayDate = normalizeDisplayDate(recentMatch.date);
    const storageDate = normalizeStorageDate(recentMatch.date);
    const snapshotKey = `${storageDate}|${recentMatch.summary}`;
    const createdAtKST = getKoreaNowString();
    const round = await ensureOpenRound(env);

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
        recentMatch.title || "최근 내전 결과",
        recentMatch.summary || "",
        topTeamInfo.teamName || "",
        topTeamInfo.score ?? null,
        JSON.stringify(winnerMembers || []),
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
    for (let i = 0; i < recentMatch.rows.length; i++) {
      const row = recentMatch.rows[i] || [];
      rowStatements.push(
        env.DB.prepare(`
          INSERT INTO match_rows (
            result_id, row_no, col1, col2, col3, col4, col5
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          resultId,
          i + 1,
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
        winner_team: topTeamInfo.teamName || "",
        winner_score: topTeamInfo.score ?? null,
        winner_members: winnerMembers,
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

