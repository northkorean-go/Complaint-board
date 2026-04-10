const { json, isAdmin } = require("./_utils");

async function onRequest(context) {
  try {
    return json(
      {
        isAdmin: isAdmin(context.request),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("me error:", error);
    return json({ error: "로그인 상태 확인 실패" }, { status: 500 });
  }
}

module.exports = { onRequest };

