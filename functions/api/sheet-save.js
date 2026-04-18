export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const data = JSON.stringify(body);

    await env.DB.prepare(`
      INSERT INTO sheet_state (id, data, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = CURRENT_TIMESTAMP
    `).bind(data).run();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
