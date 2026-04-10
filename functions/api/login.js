const ADMIN_ID = "admin";
const ADMIN_PASSWORD = "1558";
const AUTH_COOKIE = "admin_auth";
const AUTH_SECRET = "change-this-to-a-long-random-secret";

export async function onRequestPost(context) {
  const { request } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ msg: "잘못된 요청입니다." }, 400);
  }

  const username = (body.username || "").trim();
  const password = (body.password || "").trim();

  if (username !== ADMIN_ID || password !== ADMIN_PASSWORD) {
    return json({ msg: "아이디 또는 비밀번호가 올바르지 않습니다." }, 401);
  }

  const token = await createToken(username, password);

  return json(
    { ok: true, msg: "로그인 성공" },
    200,
    {
      "Set-Cookie":
        `${AUTH_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=604800`,
    }
  );
}

async function createToken(username, password) {
  const text = `${username}:${password}:${AUTH_SECRET}`;
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      ...headers,
    },
  });
}