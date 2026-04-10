import { json, readJson } from "./_utils.js";

export async function onRequestPost(context) {
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
    SET likes = likes + 1
    WHERE id = ? AND deleted = 0
  `)
    .bind(id)
    .run();

  const updated = await context.env.DB.prepare(`
    SELECT likes FROM posts WHERE id = ?
  `)
    .bind(id)
    .first();

  return json({
    success: true,
    likes: updated?.likes ?? 0,
  });
}

