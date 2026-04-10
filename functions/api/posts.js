const ADMIN_ID = "admin";
const ADMIN_PASSWORD = "1558";
const AUTH_COOKIE = "admin_auth";
const AUTH_SECRET = "change-this-to-a-long-random-secret";

export async function onRequestGet(context) {
  const { request, env } = context;

  const ok = await isAdmin(request);
  if (!ok) {
    return json({ msg: "관리자만 접근 가능합니다." }, 401);
  }

  const { results } = await env.DB.prepare(
    `SELECT id, content, date, comment
     FROM posts
     ORDER BY id DESC`
  ).all();

  return json(results || []);
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((v) => v.trim());
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

async function isAdmin(request) {
  const token = getCookie(request, AUTH_COOKIE);
  const validToken = await createToken(ADMIN_ID, ADMIN_PASSWORD);
  return token === validToken;
}

async function createToken(username, password) {
  const text = `${username}:${password}:${AUTH_SECRET}`;
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
}