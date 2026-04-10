const { json, readJson, normalizePost } = require("./_utils");

async function onRequest(context) {
  try {
    if (context.request.method !== "POST") {
      return json({ error: "Method Not Allowed" }, { status: 405 });
    }

    const body = await readJson(context.request);
    const type = String(body.type || "").trim();
    const content = String(body.content || "").trim();

    if (!content) {
      return json({ error: "내용을 입력해주세요." }, { status: 400 });
    }

    const finalType = type || "건의사항";
    const createdAt = new Date().toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const insertResult = await context.env.DB.prepare(`
      INSERT INTO posts (type, content, created_at, comment, status)
      VALUES (?, ?, ?, '', '미처리')
    `)
      .bind(finalType, content, createdAt)
      .run();

    const insertedId = insertResult.meta?.last_row_id;

    if (!insertedId) {
      return json({ success: true });
    }

    const row = await context.env.DB.prepare(`
      SELECT id, type, content, created_at, comment, status
      FROM posts
      WHERE id = ?
    `)
      .bind(insertedId)
      .first();

    return json({
      success: true,
      post: row ? normalizePost(row) : null,
    });
  } catch (error) {
    console.error("post error:", error);
    return json({ error: "게시글 등록 실패" }, { status: 500 });
  }
}

module.exports = { onRequest };
