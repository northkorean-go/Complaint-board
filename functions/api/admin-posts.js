import { json, requireAdmin } from "./_utils.js";

export async function onRequestGet(context) {
  const denied = requireAdmin(context.request);
  if (denied) return denied;

  const { results } = await context.env.DB.prepare(`
    SELECT id, type, content, status, comment, likes, deleted, created_at
    FROM posts
    ORDER BY id DESC
  `).all();

  return json(
    (results || []).map((row) => ({
      id: row.id,
      type: row.type,
      content: row.content,
      status: row.status,
      comment: row.comment,
      likes: row.likes,
      deleted: !!row.deleted,
      date: row.created_at,
    }))
  );
}

