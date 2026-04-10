const { json, parseCookies } = require("./_utils");

module.exports = async (req, res) => {
  try {
    const cookies = parseCookies(req);
    const isAdmin = cookies.adminAuth === "ok";

    return json(res, 200, {
      isAdmin,
    });
  } catch (error) {
    console.error("me error:", error);
    return json(res, 500, { error: "로그인 상태 확인 실패" });
  }
};
