const ADMIN_PASSWORD = "1558";

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const password = body.password;

    if (password !== ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ success: false, message: "비밀번호가 틀렸습니다." }),
        {
          status: 401,
          headers: { "Content-Type": "application/json; charset=UTF-8" }
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Set-Cookie": "admin_auth=1; Path=/; HttpOnly; Max-Age=3600; SameSite=Lax"
      }
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, message: "로그인 처리 오류" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=UTF-8" }
      }
    );
  }
}
