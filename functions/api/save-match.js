export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const CSV_URL =
      'https://docs.google.com/spreadsheets/d/1gvrn7SDzU7kjtXwmiJjN6Xf9HSsCDuYOo9rajIKnC7c/export?format=csv&gid=0';

    const RANKING_CSV_URL =
      'https://docs.google.com/spreadsheets/d/1gvrn7SDzU7kjtXwmiJjN6Xf9HSsCDuYOo9rajIKnC7c/export?format=csv&gid=681731975';

    const [mainRes, rankingRes] = await Promise.all([
      fetch(CSV_URL, {
        cf: { cacheTtl: 0, cacheEverything: false },
      }),
      fetch(RANKING_CSV_URL, {
        cf: { cacheTtl: 0, cacheEverything: false },
      }),
    ]);

    if (!mainRes.ok) {
      return json(
        { ok: false, error: '메인 시트 로드 실패', status: mainRes.status },
        500
      );
    }

    if (!rankingRes.ok) {
      return json(
        { ok: false, error: '랭킹 시트 로드 실패', status: rankingRes.status },
        500
      );
    }

    const csvText = await mainRes.text();
    const rankingCsvText = await rankingRes.text();

    const rows = parseCSV(csvText);
    const rankingRows = parseCSV(rankingCsvText);

    const topTeamText = buildTopTeamText(rows) || '';
    const recentMatch = findRecentDetailedMatch(rows);
    const topTeamInfo = parseTopTeamInfo(topTeamText);
    const winnerMembers = findWinningTeamMembers(rows, topTeamText);
    const mvp = findMVPPlayer(rows);

    if (!recentMatch) {
      return json(
        { ok: false, error: '최근 내전 결과를 찾지 못했습니다.' },
        400
      );
    }

    const latestRankingDate = findLastDateInRows(rankingRows);
    const displayDate = normalizeDisplayDate(latestRankingDate || recentMatch.date);
    const storageDate = normalizeStorageDate(latestRankingDate || recentMatch.date);
    const snapshotKey = `${storageDate}|${recentMatch.summary}`;
    const createdAtKST = getKoreaNowString();

    const exists = await env.DB.prepare(
      `SELECT id FROM match_results WHERE snapshot_key = ? LIMIT 1`
    )
      .bind(snapshotKey)
      .first();

    if (exists) {
      return json({
        ok: true,
        saved: false,
        message: '이미 저장된 내전 결과입니다.',
        id: exists.id,
      });
    }

    const insertResult = await env.DB.prepare(`
      INSERT INTO match_results (
        snapshot_key,
        match_date,
        match_date_text,
        title,
        summary_text,
        winner_team,
        winner_score,
        winner_members_json,
        mvp_name,
        mvp_score,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        snapshotKey,
        storageDate,
        displayDate,
        recentMatch.title || '최근 내전 결과',
        recentMatch.summary || '',
        topTeamInfo.teamName || '',
        topTeamInfo.score ?? null,
        JSON.stringify(winnerMembers || []),
        mvp ? mvp.name : '',
        mvp ? mvp.score : null,
        createdAtKST
      )
      .run();

    const resultId = insertResult.meta?.last_row_id;
    if (!resultId) {
      return json(
        { ok: false, error: '결과 저장 후 ID를 가져오지 못했습니다.' },
        500
      );
    }

    const rowStatements = [];
    for (let i = 0; i < recentMatch.rows.length; i++) {
      const row = recentMatch.rows[i] || [];
      rowStatements.push(
        env.DB.prepare(`
          INSERT INTO match_rows (
            result_id, row_no, col1, col2, col3, col4, col5
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          resultId,
          i + 1,
          row[0] || '',
          row[1] || '',
          row[2] || '',
          row[3] || '',
          row[4] || ''
        )
      );
    }

    if (rowStatements.length) {
      await env.DB.batch(rowStatements);
    }

    return json({
      ok: true,
      saved: true,
      id: resultId,
      match_date: displayDate,
      winner_team: topTeamInfo.teamName || '',
      winner_score: topTeamInfo.score ?? null,
      winner_members: winnerMembers,
      mvp_name: mvp ? mvp.name : '',
      mvp_score: mvp ? mvp.score : null,
      created_at: createdAtKST,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || '저장 중 오류가 발생했습니다.',
      },
      500
    );
  }
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders(),
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
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
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(parseCSVLine);
}

function safeText(value) {
  return String(value || '').trim();
}

function getCell(rows, r, c) {
  if (!rows[r]) return '';
  return safeText(rows[r][c]);
}

function normalizeDateText(value) {
  const text = safeText(value);
  if (!text) return '';

  let match = text.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (match) return `${match[1]}.${match[2]}`;

  match = text.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (match) return `${match[1]}.${match[2]}`;

  match = text.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (match) return `${match[2]}.${match[3]}`;

  match = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (match) return `${match[2]}.${match[3]}`;

  return '';
}

function findLastDateInRows(rows) {
  let lastDate = '';

  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const normalized = normalizeDateText(rows[r][c]);
      if (normalized) {
        lastDate = normalized;
      }
    }
  }

  return lastDate;
}

function normalizeDisplayDate(dateText) {
  const raw = normalizeDateText(dateText);
  if (!raw) {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}.${String(
      now.getDate()
    ).padStart(2, '0')}`;
  }

  const [m, d] = raw.split('.');
  return `${String(Number(m)).padStart(2, '0')}.${String(Number(d)).padStart(
    2,
    '0'
  )}`;
}

function normalizeStorageDate(dateText) {
  const display = normalizeDisplayDate(dateText);
  const [m, d] = display.split('.');
  const year = new Date().getFullYear();
  return `${year}-${m}-${d}`;
}

function getKoreaNowString() {
  const now = new Date();
  const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const year = korea.getUTCFullYear();
  const month = String(korea.getUTCMonth() + 1).padStart(2, '0');
  const date = String(korea.getUTCDate()).padStart(2, '0');
  const hours = String(korea.getUTCHours()).padStart(2, '0');
  const minutes = String(korea.getUTCMinutes()).padStart(2, '0');
  const seconds = String(korea.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
}

function buildTopTeamText(rows) {
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
    return '';
  }

  return (
    '[' +
    m11 +
    '] ' +
    b12 +
    '팀 ' +
    l15 +
    ' : ' +
    o12 +
    '팀 ' +
    y15 +
    ' : ' +
    aa12 +
    '팀 ' +
    ak15 +
    ' : ' +
    am12 +
    '팀 ' +
    aw15 +
    ' : ' +
    ay12 +
    '팀 ' +
    bi15
  );
}

function parseSummaryTeamEntries(summaryText) {
  const entries = [];
  const regex = /([^\s:\]]+?)팀\s*(-?\d+(?:\.\d+)?)/g;
  let match;

  while ((match = regex.exec(summaryText)) !== null) {
    entries.push({
      teamName: match[1].trim() + '팀',
      baseName: match[1].trim(),
      score: parseFloat(match[2]),
    });
  }

  return entries;
}

function parseTopTeamInfo(text) {
  const entries = parseSummaryTeamEntries(text);
  if (!entries.length) {
    return { teamName: '', baseName: '', score: null };
  }

  let best = entries[0];
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].score > best.score) {
      best = entries[i];
    }
  }

  return best;
}

function extractPlayerInfoFromCell(cellText) {
  const text = safeText(cellText);
  if (!text) return null;
  if (text.includes('정지') || text.includes('치킨')) return null;
  if (/^0\s*\(/.test(text)) return null;

  const match = text.match(/^([^\d]+?)\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const name = match[1].trim();
  const score = parseFloat(match[2]);

  if (!name || Number.isNaN(score)) return null;
  return { name, score };
}

function isMatchSummaryCell(text) {
  const value = safeText(text);
  return value.includes('[') && value.includes(']') && value.includes('팀');
}

function findRecentDetailedMatch(rows) {
  for (let r = rows.length - 1; r >= 0; r--) {
    for (let c = 0; c < rows[r].length; c++) {
      const summary = safeText(rows[r][c]);
      if (!isMatchSummaryCell(summary)) continue;

      let title = '';
      let date = '';

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
            !cell.includes('팀') &&
            !cell.includes('[') &&
            !cell.includes(']')
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
            filledCells.push('');
          }
          tableRows.push(filledCells.slice(0, 5));
        }
      }

      if (!tableRows.length) continue;

      return {
        title: title || '최근 내전 결과',
        date: date || '',
        summary: summary,
        rows: tableRows,
      };
    }
  }

  return null;
}

function findWinningTeamMembers(rows, topTeamText) {
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
    const playerInfo = extractPlayerInfoFromCell(row[winnerColIndex] || '');

    if (!playerInfo) continue;
    if (members.includes(playerInfo.name)) continue;

    members.push(playerInfo.name);
    if (members.length >= 4) break;
  }

  return members;
}

function findMVPPlayer(rows) {
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
