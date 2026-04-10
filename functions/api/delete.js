import { json, readJson, requireAdmin } from "./_utils.js";

export async function onRequestPost(context) {
  const denied = requireAdmin(context.request);
  if (denied) return denied;

  const body = await readJson(context.request);
  const id = Number(body.id);

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
    SET deleted = 1
    WHERE id = ?
  `)
    .bind(id)
    .run();

  return json({ success: true });
}

