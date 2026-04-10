const { json, clearAdminCookie } = require("./_utils");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { error: "Method Not Allowed" });
    }

    clearAdminCookie(res);

    return json(res, 200, {
      success: true,
      message: "로그아웃 완료",
    });
  } catch (error) {
    console.error("logout error:", error);
    return json(res, 500, { error: "로그아웃 처리 중 오류" });
  }
};
