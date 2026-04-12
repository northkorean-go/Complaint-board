import { json, badRequest, serverError, getOpenRound } from './_utils';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const alreadyOpen = await getOpenRound(env);
    if (alreadyOpen) {
      return json({
        ok: true,
        already_open: true,
        round: alreadyOpen,
      });
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const benefitText = String(body.benefit_text || '').trim();
    const nextScheduleText = String(body.next_schedule_text || '').trim();

    if (!name) {
      return badRequest('회차 이름을 입력하세요.');
    }

    const now = new Date().toISOString();

    const result = await env.DB.prepare(`
      INSERT INTO rounds (
        name,
        started_at,
        is_open,
        benefit_text,
        next_schedule_text
      )
      VALUES (?, ?, 1, ?, ?)
    `)
      .bind(name, now, benefitText, nextScheduleText)
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
      round,
    });
  } catch (error) {
    return serverError(error);
  }
}
