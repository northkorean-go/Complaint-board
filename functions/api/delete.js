const { json, requireAdmin, readJson } = require("./_utils");

async function onRequest(context) {
  const denied = requireAdmin(context.request);
  if (denied) return denied;

  try {
    if (context.request.method !== "POST") {
      return json({ error: "Method Not Allowed" }, { status: 405 });
    }

    const body = await readJson(context.request);
    const id = Number(body.id);

    if (!id) {
      return json({ error: "게시글 id가 필요합니다." }, { status: 400 });
    }

    const exists = await context.env.DB.prepare(`
      SELECT id
      FROM posts
      WHERE id = ?
    `)
      .bind(id)
      .first();

    if (!exists) {
      return json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    await context.env.DB.prepare(`
      DELETE FROM posts
      WHERE id = ?
    `)
      .bind(id)
      .run();

    return json({
      success: true,
      message: "삭제 완료",
    });
  } catch (error) {
    console.error("delete error:", error);
    return json({ error: "삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}

module.exports = { onRequest };
