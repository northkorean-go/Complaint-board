import { json } from './_utils.js';

export async function onRequestPost() {
  return json({
    ok: true,
    message: '현재는 자동 회차 생성 방식이라 round-close API를 사용하지 않습니다.'
  });
}
