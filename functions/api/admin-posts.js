const { getDB, json, requireAdmin } = require("./_utils");

module.exports = async (req, res) => {
  try {
    const blocked = await requireAdmin(req, res);
    if (blocked) return;

    const db = getDB();

    const rows = db
      .prepare(`
        SELECT
          id,
          type,
          content,
          created_at,
          comment,
          status
        FROM posts
        ORDER BY id DESC
      `)
      .all();

    const posts = rows.map((row) => ({
      id: row.id,
      type: row.type || "건의사항",
      title: row.content || "",
      content: row.content || "",
      date: row.created_at || "",
      comment: row.comment || "",
      status: row.status || (row.comment ? "처리완료" : "미처리"),
    }));

    return json(res, 200, posts);
  } catch (error) {
    console.error("admin-posts error:", error);
    return json(res, 500, { error: "관리자 게시글 조회 실패" });
  }
};
