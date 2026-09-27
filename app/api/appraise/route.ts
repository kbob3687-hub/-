import { readSubmissionJSON, limitResponse } from "@/lib/submission-guard";
import { appraise } from "@/lib/appraisal";
import { reviewSubmission, reviewResponse } from "@/lib/submission-review";
import { isArchiveImage } from "@/lib/image-policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const value = await readSubmissionJSON(request);
    if (!value || typeof value !== "object" || Array.isArray(value)) return Response.json({ error: "投稿格式不正确。" }, { status: 400 });
    const body = value as Record<string, unknown>;
    const desc = typeof body.desc === "string" ? body.desc.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : undefined;
    if (desc.length < 4 || desc.length > 280 || title.length > 30) {
      return Response.json({ error: "请用 4—280 字记录一件小事，标题不超过 30 字。" }, { status: 400 });
    }
    if (body.imageUrl != null && !isArchiveImage(body.imageUrl)) {
      return Response.json({ error: "照片格式或大小不符合要求。" }, { status: 400 });
    }
    const rejection = reviewResponse(await reviewSubmission({ desc, title, imageUrl }));
    if (rejection) return rejection;
    const result = await appraise({ desc, title, imageUrl, isPublic: body.isPublic !== false });
    return Response.json(result);
  } catch (error) {
    const limited = limitResponse(error);
    if (limited) return limited;
    return Response.json({ error: "入藏鉴定暂时中断，请重试。" }, { status: 500 });
  }
}
