import { json, serverError, getOpenRound } from './_utils';

export async function onRequestPost(context) {
  const { env } = context;

  try {
    const round = await getOpenRound(env);

    if (!round) {
      return json({
        ok: false,
        error: '열려 있는 회차가 없습니다.',
      });
    }

    const now = new Date().toISOString();

    await env.DB.prepare(`
      UPDATE rounds
      SET is_open = 0,
          ended_at = ?
      WHERE id = ?
    `)
      .bind(now, round.id)
      .run();

    return json({
      ok: true,
      closed_round_id: round.id,
    });
  } catch (error) {
    return serverError(error);
  }
}
