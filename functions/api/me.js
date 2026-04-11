function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map(v => v.trim())
      .filter(Boolean)
      .map(v => {
        const i = v.indexOf("=");
        if (i === -1) return [v, ""];
        return [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
      })
  );
}

export async function onRequestGet(context) {
  const cookieHeader = context.request.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);

  const isAdmin = cookies.admin_auth === "1";

  return new Response(
    JSON.stringify({
      success: isAdmin,
      isAdmin
    }),
    {
      status: isAdmin ? 200 : 401,
      headers: {
        "Content-Type": "application/json; charset=UTF-8"
      }
    }
  );
}
