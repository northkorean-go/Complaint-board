const { json, setAdminCookie } = require("./_utils");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { error: "Method Not Allowed" });
    }

    const body = req.body || {};
    const password = String(body.password || "").trim();

    const ADMIN_PASSWORD = "1234";

    if (!password) {
      return json(res, 400, { error: "비밀번호를 입력해주세요." });
    }

    if (password !== ADMIN_PASSWORD) {
      return json(res, 401, { error: "비밀번호가 올바르지 않습니다." });
    }

    setAdminCookie(res);
    return json(res, 200, { success: true, isAdmin: true });
  } catch (error) {
    console.error("login error:", error);
    return json(res, 500, { error: "로그인 처리 중 오류가 발생했습니다." });
  }
};
