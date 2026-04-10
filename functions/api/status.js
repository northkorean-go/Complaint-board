import { json, readJson, requireAdmin } from "./_utils.js";

export async function onRequestPost(context) {
  const denied = requireAdmin(context.request);
  if (denied) return denied;

  const body = await readJson(context.request);
  const id = Number(body.id);
  const status = String(body.status || "").trim();

  const allowed = ["processing", "done", "hold"];

  if (!id || !allowed.includes(status)) {
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
    SET status = ?
    WHERE id = ?
  `)
    .bind(status, id)
    .run();

  return json({ success: true });
}

