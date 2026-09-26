import { ArtifactDraft, isArtifactTag } from "@/lib/artifact";
import { readPublicArtifactSnapshot, saveArtifact } from "@/lib/store";
import { matchesIfNoneMatch } from "@/lib/http-etag";
import { isArchiveImage } from "@/lib/image-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const snapshot = await readPublicArtifactSnapshot();
    const headers = { "Cache-Control": "private, no-cache", ETag: snapshot.etag };
    if (matchesIfNoneMatch(request.headers.get("If-None-Match"), snapshot.etag)) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(snapshot.body, { headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
  } catch {
    return Response.json({ error: "展厅暂时无法读取。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const draft = (await request.json()) as ArtifactDraft | null;
    if (
      !draft ||
      draft.isPublic !== true ||
      typeof draft.desc !== "string" || draft.desc.length < 4 || draft.desc.length > 280 ||
      typeof draft.title !== "string" || draft.title.length < 1 || draft.title.length > 50 ||
      typeof draft.tag !== "string" || !isArtifactTag(draft.tag) ||
      !Array.isArray(draft.cot) || draft.cot.length !== 3 || draft.cot.some((step) => typeof step !== "string" || step.length > 90) ||
      typeof draft.appraisalConclusion !== "string" || draft.appraisalConclusion.length > 100 ||
      !draft.metrics || typeof draft.metrics.gdpContribution !== "string" || typeof draft.metrics.entropyIncrease !== "string" ||
      (draft.imageUrl != null && !isArchiveImage(draft.imageUrl))
    ) {
      return Response.json({ error: "馆藏内容不符合入库格式。" }, { status: 400 });
    }
    const artifact = await saveArtifact(draft);
    return Response.json({ artifact }, { status: 201 });
  } catch {
    return Response.json({ error: "入库失败，请重试。" }, { status: 500 });
  }
}
