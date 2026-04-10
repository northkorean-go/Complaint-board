export async function onRequestPost({ request, env }) {
  const { commentId } = await request.json();

  const deletedAt = new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });

  await env.DB.prepare(
    "UPDATE comments SET is_deleted = 1, deleted_at = ? WHERE id = ?"
  )
    .bind(deletedAt, commentId)
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
