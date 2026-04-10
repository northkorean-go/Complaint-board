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
    const status = String(body.status || "").trim();

    if (!id) {
      return json({ error: "게시글 id가 필요합니다." }, { status: 400 });
    }

    if (!["처리완료", "미처리"].includes(status)) {
      return json({ error: "올바른 상태값이 필요합니다." }, { status: 400 });
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
      UPDATE posts
      SET status = ?
      WHERE id = ?
    `)
      .bind(status, id)
      .run();

    return json({
      success: true,
      message: "상태 변경 완료",
    });
  } catch (error) {
    console.error("status error:", error);
    return json({ error: "상태 변경 중 오류가 발생했습니다." }, { status: 500 });
  }
}

module.exports = { onRequest };
