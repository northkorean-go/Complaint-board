import { json, readJson, getAdminCredentials } from "./_utils.js";

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const { username = "", password = "" } = body;

  const admin = getAdminCredentials();

  if (username !== admin.id || password !== admin.password) {
    return json(
      { success: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." },
      401
    );
  }

  return json(
    { success: true },
    200,
    {
      "Set-Cookie": `admin_token=${admin.token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=604800`,
    }
  );
}
