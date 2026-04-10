const { json, setAdminCookie, readJson } = require("./_utils");

async function onRequest(context) {
  try {
    if (context.request.method !== "POST") {
      return json({ error: "Method Not Allowed" }, { status: 405 });
    }

    const body = await readJson(context.request);
    const password = String(body.password || "").trim();

    const ADMIN_PASSWORD = "1234";

    if (!password) {
      return json({ error: "비밀번호를 입력해주세요." }, { status: 400 });
    }

    if (password !== ADMIN_PASSWORD) {
      return json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    return json(
      { success: true, isAdmin: true },
      {
        status: 200,
        headers: {
          "Set-Cookie": setAdminCookie(),
        },
      }
    );
  } catch (error) {
    console.error("login error:", error);
    return json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

module.exports = { onRequest };
