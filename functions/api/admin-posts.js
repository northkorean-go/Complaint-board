const { json, requireAdmin, normalizePost } = require("./_utils");

async function onRequest(context) {
  const denied = requireAdmin(context.request);
  if (denied) return denied;

  try {
    const { results } = await context.env.DB.prepare(`
      SELECT id, type, content, created_at, comment, status
      FROM posts
      ORDER BY id DESC
    `).all();

    return json(results.map(normalizePost));
  } catch (error) {
    console.error("admin-posts error:", error);
    return json({ error: "관리자 게시글 조회 실패" }, { status: 500 });
  }
}

module.exports = { onRequest };
