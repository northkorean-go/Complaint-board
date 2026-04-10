export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Set-Cookie":
        "admin_auth=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0",
    },
  });
}