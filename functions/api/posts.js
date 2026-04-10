import { json } from "./_utils.js";

export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(`
      SELECT id, type, status, likes, deleted, created_at
      FROM posts
      ORDER BY id DESC
    `).all();

    return json(
      (results || []).map((row) => ({
        id: row.id,
        type: row.type,
        status: row.status,
        likes: row.likes || 0,
        deleted: !!row.deleted,
        date: row.created_at,
      }))
    );
  } catch (error) {
    return json(
      {
        success: false,
        message: `목록 불러오기 실패: ${error.message || "알 수 없는 오류"}`
      },
      500
    );
  }
}
