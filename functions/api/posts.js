const { json, normalizePost } = require("./_utils");

async function onRequest(context) {
  try {
    const { results } = await context.env.DB.prepare(`
      SELECT id, type, content, created_at, comment, status
      FROM posts
      ORDER BY id DESC
      LIMIT 20
    `).all();

    return json(results.map(normalizePost), { status: 200 });
  } catch (error) {
    console.error("posts error:", error);
    return json({ error: "게시글 목록 조회 실패" }, { status: 500 });
  }
}

module.exports = { onRequest };
