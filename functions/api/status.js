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
    const status = String(body.status || "").trim();

    if (!id) {
      return json(res, 400, { error: "게시글 id가 필요합니다." });
    }

    if (!status || !["처리완료", "미처리"].includes(status)) {
      return json(res, 400, { error: "올바른 상태값이 필요합니다." });
    }

    const db = getDB();

    const exists = db.prepare("SELECT id FROM posts WHERE id = ?").get(id);
    if (!exists) {
      return json(res, 404, { error: "게시글을 찾을 수 없습니다." });
    }

    db.prepare(`
      UPDATE posts
      SET status = ?
      WHERE id = ?
    `).run(status, id);

    return json(res, 200, {
      success: true,
      message: "상태 변경 완료",
    });
  } catch (error) {
    console.error("status error:", error);
    return json(res, 500, { error: "상태 변경 중 오류가 발생했습니다." });
  }
};
