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
    if (!openRound) {
      return json(
        {
          ok: false,
          error: "현재 열린 회차가 없습니다.",
        },
        400
      );
    }

    const body = await readJson(request);
    const endedAt = getKoreaNowString();

    const name = String(body.name || "").trim() || openRound.name;
    const benefitText =
      body.benefit_text !== undefined
        ? String(body.benefit_text || "").trim()
        : String(openRound.benefit_text || "").trim();

    const nextScheduleText =
      body.next_schedule_text !== undefined
        ? String(body.next_schedule_text || "").trim() || "미정"
        : String(openRound.next_schedule_text || "").trim() || "미정";

    await env.DB.prepare(`
      UPDATE rounds
      SET
        name = ?,
        benefit_text = ?,
        next_schedule_text = ?,
        is_open = 0,
        ended_at = ?
      WHERE id = ?
    `)
      .bind(name, benefitText, nextScheduleText, endedAt, openRound.id)
      .run();

    const round = await env.DB.prepare(`
      SELECT *
      FROM rounds
      WHERE id = ?
    `)
      .bind(openRound.id)
      .first();

    return json({
      ok: true,
      message: "회차가 종료되었습니다.",
      round,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "회차 종료 중 오류가 발생했습니다.",
      },
      500
    );
  }
}
