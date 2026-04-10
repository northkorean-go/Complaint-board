const { getDB, json, requireAdmin } = require("./_utils");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { error: "Method Not Allowed" });
    }

    const blocked = await requireAdmin(req, res);
    if (blocked) return;

    const body = req.body || {};
    const id = Number(body.id);
    const comment = String(body.comment || "").trim();

    if (!id) {
      return json(res, 400, { error: "게시글 id가 필요합니다." });
    }

    if (!comment) {
      return json(res, 400, { error: "댓글 내용을 입력해주세요." });
    }

    const db = getDB();

    const exists = db.prepare("SELECT id FROM posts WHERE id = ?").get(id);
    if (!exists) {
      return json(res, 404, { error: "게시글을 찾을 수 없습니다." });
    }

    db.prepare(`
      UPDATE posts
      SET comment = ?, status = '처리완료'
      WHERE id = ?
    `).run(comment, id);

    return json(res, 200, {
      success: true,
      message: "댓글 저장 완료",
    });
  } catch (error) {
    console.error("comment error:", error);
    return json(res, 500, { error: "댓글 저장 중 오류가 발생했습니다." });
  }
};
