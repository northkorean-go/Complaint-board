import { json, requireAdmin } from "./_utils.js";

function corsHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function withCors(response) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders();
  Object.keys(cors).forEach((key) => headers.set(key, cors[key]));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  if (request.method !== "POST") {
    return withCors(json({ ok: false, error: "Method not allowed" }, 405));
  }

  const adminDenied = requireAdmin(request);
  if (adminDenied) {
    return withCors(adminDenied);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id || 0);

    if (!id) {
      return withCors(json({ ok: false, error: "삭제할 기록 ID가 없습니다." }, 400));
    }

    const exists = await env.DB.prepare(
      `SELECT id FROM match_results WHERE id = ? LIMIT 1`
    ).bind(id).first();

    if (!exists) {
      return withCors(json({ ok: false, error: "해당 기록을 찾을 수 없습니다." }, 404));
    }

    await env.DB.batch([
      env.DB.prepare(`DELETE FROM match_rows WHERE result_id = ?`).bind(id),
      env.DB.prepare(`DELETE FROM match_results WHERE id = ?`).bind(id),
    ]);

    return withCors(json({ ok: true, deleted_id: id }));
  } catch (error) {
    return withCors(
      json(
        {
          ok: false,
          error: error.message || "기록 삭제 중 오류가 발생했습니다.",
        },
        500
      )
    );
  }
}
