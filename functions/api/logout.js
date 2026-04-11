export async function onRequestPost() {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Set-Cookie": [
        "admin_auth=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax",
        "admin_auth=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax"
      ].join(", ")
    }
  });
}
