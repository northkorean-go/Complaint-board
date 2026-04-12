export async function onRequest({ request, env }) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));

    if (!id) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "id가 올바르지 않습니다.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json; charset=UTF-8" },
        }
      );
    }

    const item = await env.DB.prepare(`
      SELECT * FROM match_results WHERE id = ?
    `)
      .bind(id)
      .first();

    if (!item) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "기록을 찾을 수 없습니다.",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json; charset=UTF-8" },
        }
      );
    }

    const rows = await env.DB.prepare(`
      SELECT * FROM match_rows WHERE result_id = ? ORDER BY row_no
    `)
      .bind(id)
      .all();

    return new Response(
      JSON.stringify({
        ok: true,
        item: {
          ...item,
          rows: rows.results || [],
        },
      }),
      {
        headers: { "Content-Type": "application/json; charset=UTF-8" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || "상세 조회 실패",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=UTF-8" },
      }
    );
  }
}
