export async function onRequestPost({ request, env }) {
  const { postId, content } = await request.json();

  if (!content) {
    return new Response(JSON.stringify({ msg: "내용 입력" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const date = new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });

  await env.DB.prepare(
    "INSERT INTO comments (post_id, content, date) VALUES (?, ?, ?)"
  )
    .bind(postId, content, date)
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
