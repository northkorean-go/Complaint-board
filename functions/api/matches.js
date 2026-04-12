export async function onRequest({ env }) {
  try {
    const rows = await env.DB.prepare(`
      SELECT
        id,
        round_id,
        match_date,
        match_date_text,
        title,
        winner_team,
        winner_score,
        mvp_name,
        mvp_score,
        created_at
      FROM match_results
      ORDER BY match_date DESC, id DESC
    `).all();

    return new Response(
      JSON.stringify({
        ok: true,
        items: rows.results || [],
      }),
      {
        headers: { "Content-Type": "application/json; charset=UTF-8" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || "기록 목록 조회 실패",
        items: [],
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=UTF-8" },
      }
    );
  }
}
