function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function parseCookies(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = {};

  cookieHeader.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return;
    cookies[key] = decodeURIComponent(rest.join("="));
  });

  return cookies;
}

function isAdmin(request) {
  const cookies = parseCookies(request);
  return cookies.adminAuth === "ok";
}

function unauthorized() {
  return json({ error: "Unauthorized" }, { status: 401 });
}

function requireAdmin(request) {
  if (!isAdmin(request)) {
    return unauthorized();
  }
  return null;
}

function setAdminCookie() {
  return "adminAuth=ok; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800";
}

function clearAdminCookie() {
  return "adminAuth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function normalizePost(row) {
  return {
    id: row.id,
    type: row.type || "건의사항",
    title: row.content || "",
    content: row.content || "",
    date: row.created_at || "",
    comment: row.comment || "",
    status: row.status || (row.comment ? "처리완료" : "미처리"),
  };
}

module.exports = {
  json,
  parseCookies,
  isAdmin,
  requireAdmin,
  setAdminCookie,
  clearAdminCookie,
  readJson,
  normalizePost,
};
