export async function onRequest({ request, env }) {
  const id = new URL(request.url).searchParams.get('id');

  const item = await env.DB.prepare(`
    SELECT * FROM match_results WHERE id = ?
  `).bind(id).first();

  const rows = await env.DB.prepare(`
    SELECT * FROM match_rows WHERE result_id = ? ORDER BY row_no
  `).bind(id).all();

  return new Response(JSON.stringify({
    ok: true,
    item: {
      ...item,
      rows: rows.results
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
