export async function onRequest(context) {
  return new Response(
    JSON.stringify({ ok: true, route: "/api/posts" }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}
