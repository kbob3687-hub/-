import { appraise } from "@/lib/appraisal";
import { isProductiveSubmission } from "@/lib/offline-appraisal";
import { isArchiveImage } from "@/lib/image-policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const desc = typeof body.desc === "string" ? body.desc.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : undefined;
    if (desc.length < 4 || desc.length > 280 || title.length > 30) {
      return Response.json({ error: "请用 4—280 字记录一件小事，标题不超过 30 字。" }, { status: 400 });
    }
    if (body.imageUrl != null && !isArchiveImage(body.imageUrl)) {
      return Response.json({ error: "照片格式或大小不符合要求。" }, { status: 400 });
    }
    if (isProductiveSubmission(desc)) {
      return Response.json({ error: "检测到明确的生产任务。本馆暂不收藏，请换一件没有产出的小事。", rejected: true }, { status: 422 });
    }
    const result = await appraise({ desc, title, imageUrl, isPublic: body.isPublic !== false });
    return Response.json(result);
  } catch {
    return Response.json({ error: "入藏鉴定暂时中断，请重试。" }, { status: 500 });
  }
}
