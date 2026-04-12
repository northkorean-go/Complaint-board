export async function onRequest({ env }) {
  const rows = await env.DB.prepare(`
    SELECT id, match_date_text, winner_team
    FROM match_results
    ORDER BY match_date DESC
  `).all();

  return new Response(JSON.stringify({
    ok: true,
    items: rows.results
  }), { headers: { 'Content-Type': 'application/json' } });
}
