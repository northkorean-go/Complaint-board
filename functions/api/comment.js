import { json, readJson, requireAdmin } from "./_utils.js";

export async function onRequestPost(context) {
  try {
    const denied = requireAdmin(context.request);
    if (denied) return denied;

    const body = await readJson(context.request);
    const id = Number(body.id);
    const comment = String(body.comment || "").trim();

    if (!id) {
      return json({ success: false, message: "잘못된 요청입니다." }, 400);
    }

    const existing = await context.env.DB.prepare(`
      SELECT id FROM posts WHERE id = ?
    `)
      .bind(id)
      .first();

    if (!existing) {
      return json({ success: false, message: "게시글을 찾을 수 없습니다." }, 404);
    }

    await context.env.DB.prepare(`
      UPDATE posts
      SET comment = ?
      WHERE id = ?
    `)
      .bind(comment, id)
      .run();

    return json({ success: true, message: "댓글이 저장되었습니다." });
  } catch (error) {
    return json(
      {
        success: false,
        message: `댓글 저장 실패: ${error.message || "알 수 없는 오류"}`
      },
      500
    );
  }
}
