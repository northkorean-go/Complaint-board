import {
  json,
  readJson,
  requireAdmin,
  getOpenRound,
  getKoreaNowString,
} from "./_utils.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const openRound = await getOpenRound(env);
    if (openRound) {
      return json(
        {
          ok: false,
          error: `이미 열린 회차가 있습니다. (${openRound.name})`,
          round: openRound,
        },
        400
      );
    }

    const body = await readJson(request);
    const now = getKoreaNowString();

    const name = String(body.name || "").trim() || `${now.slice(0, 10)} 회차`;
    const benefitText = String(body.benefit_text || "").trim();
    const nextScheduleText =
      String(body.next_schedule_text || "").trim() || "미정";

    const result = await env.DB.prepare(`
      INSERT INTO rounds (
        name,
        started_at,
        ended_at,
        is_open,
        benefit_text,
        next_schedule_text,
        created_at
      ) VALUES (?, ?, NULL, 1, ?, ?, ?)
    `)
      .bind(name, now, benefitText, nextScheduleText, now)
      .run();

    const round = await env.DB.prepare(`
      SELECT *
      FROM rounds
      WHERE id = ?
    `)
      .bind(result.meta.last_row_id)
      .first();

    return json({
      ok: true,
      message: "회차가 오픈되었습니다.",
      round,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "회차 오픈 중 오류가 발생했습니다.",
      },
      500
    );
  }
}
