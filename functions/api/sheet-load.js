export async function onRequestGet(context) {
  const { env } = context;

  try {
    const row = await env.DB.prepare(`
      SELECT data FROM sheet_state WHERE id = 1
    `).first();

    if (!row) {
      return new Response(JSON.stringify({ ok: true, data: null }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      data: JSON.parse(row.data)
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
