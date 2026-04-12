const ADMIN_ID = "admin";
const ADMIN_PASSWORD = "1558";
const ADMIN_TOKEN = "zara-admin-token-v1";

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function badRequest(message) {
  return json({ ok: false, error: message }, 400);
}

export function serverError(error) {
  return json(
    {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    },
    500
  );
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => {
        const i = v.indexOf("=");
        if (i === -1) return [v, ""];
        return [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
      })
  );
}

export function requireAdmin(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const isAdmin = cookies.admin_auth === "1";

  if (!isAdmin) {
    return json(
      { success: false, message: "관리자만 접근 가능합니다." },
      401
    );
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

export function safeText(value) {
  return String(value || "").trim();
}

export function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export function parseCSV(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(parseCSVLine);
}

export function getCell(rows, r, c) {
  if (!rows[r]) return "";
  return safeText(rows[r][c]);
}

export function normalizeDateText(value) {
  const text = safeText(value);
  if (!text) return "";

  let match = text.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (match) return `${match[1]}.${match[2]}`;

  match = text.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (match) return `${match[1]}.${match[2]}`;

  match = text.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (match) return `${match[2]}.${match[3]}`;

  match = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (match) return `${match[2]}.${match[3]}`;

  return "";
}

export function normalizeDisplayDate(dateText) {
  const raw = normalizeDateText(dateText);
  if (!raw) {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, "0")}.${String(
      now.getDate()
    ).padStart(2, "0")}`;
  }

  const [m, d] = raw.split(".");
  return `${String(Number(m)).padStart(2, "0")}.${String(Number(d)).padStart(
    2,
    "0"
  )}`;
}

export function normalizeStorageDate(dateText) {
  const display = normalizeDisplayDate(dateText);
  const [m, d] = display.split(".");
  const year = new Date().getFullYear();
  return `${year}-${m}-${d}`;
}

export function getKoreaNowString() {
  const now = new Date();
  const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const year = korea.getUTCFullYear();
  const month = String(korea.getUTCMonth() + 1).padStart(2, "0");
  const date = String(korea.getUTCDate()).padStart(2, "0");
  const hours = String(korea.getUTCHours()).padStart(2, "0");
  const minutes = String(korea.getUTCMinutes()).padStart(2, "0");
  const seconds = String(korea.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
}

export function buildTopTeamText(rows) {
  const m11 = getCell(rows, 10, 12);
  const b12 = getCell(rows, 11, 1);
  const l15 = getCell(rows, 14, 11);

  const o12 = getCell(rows, 11, 14);
  const y15 = getCell(rows, 14, 24);

  const aa12 = getCell(rows, 11, 26);
  const ak15 = getCell(rows, 14, 36);

  const am12 = getCell(rows, 11, 38);
  const aw15 = getCell(rows, 14, 48);

  const ay12 = getCell(rows, 11, 50);
  const bi15 = getCell(rows, 14, 60);

  if (
    !m11 &&
    !b12 &&
    !l15 &&
    !o12 &&
    !y15 &&
    !aa12 &&
    !ak15 &&
    !am12 &&
    !aw15 &&
    !ay12 &&
    !bi15
  ) {
    return "";
  }

  return (
    "[" +
    m11 +
    "] " +
    b12 +
    "팀 " +
    l15 +
    " : " +
    o12 +
    "팀 " +
    y15 +
    " : " +
    aa12 +
    "팀 " +
    ak15 +
    " : " +
    am12 +
    "팀 " +
    aw15 +
    " : " +
    ay12 +
    "팀 " +
    bi15
  );
}

export function parseSummaryTeamEntries(summaryText) {
  const entries = [];
  const regex = /([^\s:\]]+?)팀\s*(-?\d+(?:\.\d+)?)/g;
  let match;

  while ((match = regex.exec(summaryText)) !== null) {
    entries.push({
      teamName: match[1].trim() + "팀",
      baseName: match[1].trim(),
      score: parseFloat(match[2]),
    });
  }

  return entries;
}

export function parseTopTeamInfo(text) {
  const entries = parseSummaryTeamEntries(text);
  if (!entries.length) {
    return { teamName: "", baseName: "", score: null };
  }

  let best = entries[0];
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].score > best.score) {
      best = entries[i];
    }
  }

  return best;
}

export function extractPlayerInfoFromCell(cellText) {
  const text = safeText(cellText);
  if (!text) return null;
  if (text.includes("정지") || text.includes("치킨")) return null;
  if (/^0\s*\(/.test(text)) return null;

  const match = text.match(/^([^\d]+?)\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const name = match[1].trim();
  const score = parseFloat(match[2]);

  if (!name || Number.isNaN(score)) return null;
  return { name, score };
}

export function isMatchSummaryCell(text) {
  const value = safeText(text);
  return value.includes("[") && value.includes("]") && value.includes("팀");
}

export function findRecentDetailedMatch(rows) {
  for (let r = rows.length - 1; r >= 0; r--) {
    for (let c = 0; c < rows[r].length; c++) {
      const summary = safeText(rows[r][c]);
      if (!isMatchSummaryCell(summary)) continue;

      let title = "";
      let date = "";

      for (
        let rr = Math.max(0, r - 3);
        rr <= Math.min(rows.length - 1, r + 1);
        rr++
      ) {
        const left = Math.max(0, c - 6);
        const right = Math.min((rows[rr] || []).length - 1, c + 12);

        for (let cc = left; cc <= right; cc++) {
          const cell = safeText(rows[rr][cc]);
          if (!cell) continue;

          const normalizedDate = normalizeDateText(cell);
          if (normalizedDate) {
            date = normalizedDate;
            continue;
          }

          if (
            !title &&
            !isMatchSummaryCell(cell) &&
            !normalizeDateText(cell) &&
            cell.length <= 12 &&
            !cell.includes("팀") &&
            !cell.includes("[") &&
            !cell.includes("]")
          ) {
            title = cell;
          }
        }
      }

      const tableRows = [];

      for (let rr = r + 1; rr <= r + 5; rr++) {
        if (!rows[rr]) continue;

        const startCol = Math.max(0, c - 6);
        const endCol = Math.min((rows[rr] || []).length - 1, c + 12);
        const filledCells = [];

        for (let cc = startCol; cc <= endCol; cc++) {
          const text = safeText(rows[rr][cc]);
          if (text) filledCells.push(text);
        }

        if (filledCells.length) {
          while (filledCells.length < 5) {
            filledCells.push("");
          }
          tableRows.push(filledCells.slice(0, 5));
        }
      }

      if (!tableRows.length) continue;

      return {
        title: title || "최근 내전 결과",
        date: date || "",
        summary,
        rows: tableRows,
      };
    }
  }

  return null;
}

export function findWinningTeamMembers(rows, topTeamText) {
  const topTeamInfo = parseTopTeamInfo(topTeamText);
  if (!topTeamInfo.teamName) return [];

  const winnerBaseName = topTeamInfo.baseName;
  const recentMatch = findRecentDetailedMatch(rows);
  if (!recentMatch || !recentMatch.rows || !recentMatch.rows.length) return [];

  const teams = parseSummaryTeamEntries(recentMatch.summary);
  if (!teams.length) return [];

  const winnerColIndex = teams.findIndex(
    (team) => team.baseName === winnerBaseName
  );
  if (winnerColIndex === -1) return [];

  const members = [];

  for (let r = 0; r < recentMatch.rows.length; r++) {
    const row = recentMatch.rows[r] || [];
    const playerInfo = extractPlayerInfoFromCell(row[winnerColIndex] || "");

    if (!playerInfo) continue;
    if (members.includes(playerInfo.name)) continue;

    members.push(playerInfo.name);
    if (members.length >= 4) break;
  }

  return members;
}

export function findMVPPlayer(rows) {
  const recentMatch = findRecentDetailedMatch(rows);
  if (!recentMatch || !recentMatch.rows || !recentMatch.rows.length) return null;

  let best = null;

  for (let r = 0; r < recentMatch.rows.length; r++) {
    const row = recentMatch.rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const playerInfo = extractPlayerInfoFromCell(row[c]);
      if (!playerInfo) continue;

      if (!best || playerInfo.score > best.score) {
        best = playerInfo;
      }
    }
  }

  return best;
}

export async function getOpenRound(env) {
  return await env.DB.prepare(`
    SELECT *
    FROM rounds
    WHERE is_open = 1
    ORDER BY id DESC
    LIMIT 1
  `).first();
}

export async function getLatestRound(env) {
  return await env.DB.prepare(`
    SELECT *
    FROM rounds
    ORDER BY id DESC
    LIMIT 1
  `).first();
}

