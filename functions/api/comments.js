export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const postId = url.searchParams.get("postId");

  const result = await env.DB.prepare(
    "SELECT id, content, date, is_deleted, deleted_at FROM comments WHERE post_id = ? ORDER BY id DESC"
  )
    .bind(postId)
    .all();

  return new Response(JSON.stringify(result.results), {
    headers: { "Content-Type": "application/json" },
  });
}
