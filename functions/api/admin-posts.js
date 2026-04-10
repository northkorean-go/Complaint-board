import { json, requireAdmin } from "./_utils.js";

export async function onRequestGet(context) {
  const denied = requireAdmin(context.request);
  if (denied) return denied;

  try {
    const { results: postResults } = await context.env.DB.prepare(`
      SELECT id, type, content, status, likes, deleted, created_at
      FROM posts
      ORDER BY id DESC
    `).all();

    const posts = (postResults || []).map((row) => ({
      id: row.id,
      type: row.type,
      content: row.content || "",
      status: row.status,
      likes: row.likes || 0,
      deleted: !!row.deleted,
      date: row.created_at,
      comments: []
    }));

    const { results: commentResults } = await context.env.DB.prepare(`
      SELECT id, post_id, content, created_at
      FROM comments
      ORDER BY id ASC
    `).all();

    const commentMap = {};
    for (const row of commentResults || []) {
      if (!commentMap[row.post_id]) {
        commentMap[row.post_id] = [];
      }

      commentMap[row.post_id].push({
        id: row.id,
        content: row.content || "",
        date: row.created_at
      });
    }

    for (const post of posts) {
      post.comments = commentMap[post.id] || [];
      post.comment = post.comments.length
        ? post.comments[post.comments.length - 1].content
        : "";
    }

    return json(posts);
  } catch (error) {
    return json(
      {
        success: false,
        message: `관리자 목록 불러오기 실패: ${error.message || "알 수 없는 오류"}`
      },
      500
    );
  }
}
