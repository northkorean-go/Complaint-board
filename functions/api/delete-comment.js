import { json, readJson, requireAdmin } from "./_utils.js";

export async function onRequestPost(context) {
  try {
    const denied = requireAdmin(context.request);
    if (denied) return denied;

    const body = await readJson(context.request);
    const id = Number(body.id);

    if (!id) {
      return json({ success: false, message: "댓글 ID 오류" }, 400);
    }

    await context.env.DB.prepare(`
      UPDATE comments
      SET deleted = 1
      WHERE id = ?
    `)
      .bind(id)
      .run();

    return json({ success: true });
  } catch (error) {
    return json(
      { success: false, message: "댓글 삭제 실패" },
      500
    );
  }
}
