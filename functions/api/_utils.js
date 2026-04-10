const Database = require("better-sqlite3");

let db;

function getDB() {
  if (!db) {
    db = new Database("zara.db");
    db.pragma("journal_mode = WAL");

    db.prepare(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        comment TEXT DEFAULT '',
        status TEXT DEFAULT '미처리'
      )
    `).run();
  }

  return db;
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = {};

  cookieHeader.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return;
    cookies[key] = decodeURIComponent(rest.join("="));
  });

  return cookies;
}

async function requireAdmin(req, res) {
  const cookies = parseCookies(req);

  if (cookies.adminAuth !== "ok") {
    json(res, 401, { error: "Unauthorized" });
    return true;
  }

  return false;
}

function setAdminCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "adminAuth=ok; Path=/; HttpOnly; SameSite=Lax"
  );
}

function clearAdminCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "adminAuth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
  );
}

module.exports = {
  getDB,
  json,
  parseCookies,
  requireAdmin,
  setAdminCookie,
  clearAdminCookie,
};
