const { json, clearAdminCookie } = require("./_utils");

async function onRequest(context) {
  try {
    if (context.request.method !== "POST") {
      return json({ error: "Method Not Allowed" }, { status: 405 });
    }

    return json(
      {
        success: true,
        message: "로그아웃 완료",
      },
      {
        status: 200,
        headers: {
          "Set-Cookie": clearAdminCookie(),
        },
      }
    );
  } catch (error) {
    console.error("logout error:", error);
    return json({ error: "로그아웃 처리 중 오류" }, { status: 500 });
  }
}

module.exports = { onRequest };
