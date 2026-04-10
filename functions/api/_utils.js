const ADMIN_ID = "admin";
const ADMIN_PASSWORD = "1234";
const ADMIN_TOKEN = "zara-admin-token-v1";

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function parseCookies(request) {
  const cookie = request.headers.get("cookie") || "";
  return Object.fromEntries(
    cookie
      .split(";")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => {
        const i = v.indexOf("=");
        return i === -1 ? [v, ""] : [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
      })
  );
}

export function isAdmin(request) {
  const cookies = parseCookies(request);
  return cookies.admin_token === ADMIN_TOKEN;
}

export function requireAdmin(request) {
  if (!isAdmin(request)) {
    return json({ success: false, message: "관리자만 접근 가능합니다." }, 401);
  }
  return null;
}

export function getAdminCredentials() {
  return {
    id: ADMIN_ID,
    password: ADMIN_PASSWORD,
    token: ADMIN_TOKEN,
  };
}
