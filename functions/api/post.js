export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ msg: "잘못된 요청입니다." }, 400);
  }

  const content = (body.content || "").trim();

  if (!content) {
    return json({ msg: "내용을 입력해주세요." }, 400);
  }

  const date = getKoreanTimeString();

  const result = await env.DB.prepare(
    `INSERT INTO posts (content, date, comment) VALUES (?, ?, ?)`
  )
    .bind(content, date, "")
    .run();

  return json({
    ok: true,
    msg: "등록 완료",
    id: result.meta.last_row_id,
  });
}

function getKoreanTimeString() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      ...headers,
    },
  });
}