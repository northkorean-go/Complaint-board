import { json, readJson } from "./_utils.js";

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);

    const content = String(body.content || "").trim();
    const type = body.type === "complaint" ? "complaint" : "suggestion";

    if (!content) {
      return json(
        { success: false, message: "내용을 입력해주세요." },
        400
      );
    }

    const createdAt = new Date().toISOString();

    await context.env.DB.prepare(`
      INSERT INTO posts (type, content, status, comment, likes, deleted, created_at)
      VALUES (?, ?, 'processing', '', 0, 0, ?)
    `)
      .bind(type, content, createdAt)
      .run();

    return json({
      success: true,
      message: "등록되었습니다."
    });
  } catch (error) {
    return json(
      {
        success: false,
        message: `등록 실패: ${error.message || "알 수 없는 오류"}`
      },
      500
    );
  }
}
