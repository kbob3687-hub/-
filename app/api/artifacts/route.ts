import { createHash } from "node:crypto";
import { readSubmissionJSON, limitResponse, singleSubmission } from "@/lib/submission-guard";
import { ArtifactDraft, isArtifactTag } from "@/lib/artifact";
import { readPublicArtifactSnapshot, readArtifacts, saveArtifact, assertArchiveCapacity } from "@/lib/store";
import { matchesIfNoneMatch } from "@/lib/http-etag";
import { isArchiveImage } from "@/lib/image-policy";
import { reviewSubmission, reviewResponse } from "@/lib/submission-review";

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
    const draft = (await readSubmissionJSON(request)) as ArtifactDraft | null;
    if (
      !draft ||
      draft.isPublic !== true ||
      typeof draft.desc !== "string" || draft.desc.length < 4 || draft.desc.length > 280 ||
      typeof draft.title !== "string" || draft.title.length < 1 || draft.title.length > 50 ||
      typeof draft.tag !== "string" || !isArtifactTag(draft.tag) ||
      !Array.isArray(draft.cot) || draft.cot.length !== 3 || draft.cot.some((step) => typeof step !== "string" || step.length > 90) ||
      typeof draft.appraisalConclusion !== "string" || draft.appraisalConclusion.length > 100 ||
      !draft.metrics || typeof draft.metrics.gdpContribution !== "string" || draft.metrics.gdpContribution.length > 50 || typeof draft.metrics.entropyIncrease !== "string" || draft.metrics.entropyIncrease.length > 50 ||
      (draft.imageUrl != null && !isArchiveImage(draft.imageUrl))
    ) {
      return Response.json({ error: "馆藏内容不符合入库格式。" }, { status: 400 });
    }
    // Persist only reviewed fields; never retain arbitrary client-supplied extras.
    const cleanDraft: ArtifactDraft = {
      desc: draft.desc, title: draft.title, tag: draft.tag, cot: draft.cot,
      appraisalConclusion: draft.appraisalConclusion,
      metrics: { gdpContribution: draft.metrics.gdpContribution, entropyIncrease: draft.metrics.entropyIncrease },
      imageUrl: draft.imageUrl, isPublic: true,
    };
    const requestKey = request.headers.get("Idempotency-Key") ?? "legacy";
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(requestKey)) return Response.json({ error: "投稿凭据格式不正确。" }, { status: 400 });
    // Bind retry identity to the reviewed fields; changed content never reuses approval.
    const key = createHash("sha256").update(requestKey).update(JSON.stringify(cleanDraft)).digest("hex");
    return await singleSubmission(key, async () => {
      const catalogue = await readArtifacts();
      const existing = catalogue.find(item => item.submissionKey === key);
      if (existing) {
        const { submissionKey: _key, ...artifact } = existing;
        return Response.json({ artifact }, { status: 200 });
      }
      assertArchiveCapacity(cleanDraft, catalogue);
      // Recheck the exact material being published, including client-edited captions.
      // A successful appraisal is never authorization to bypass this final gate.
      const rejection = reviewResponse(await reviewSubmission({
        desc: draft.desc, title: draft.title, imageUrl: draft.imageUrl,
        exhibitionText: [...draft.cot, draft.appraisalConclusion, draft.tag, draft.metrics.gdpContribution, draft.metrics.entropyIncrease],
      }));
      if (rejection) return rejection;
      const saved = await saveArtifact(cleanDraft, key);
      const { submissionKey: _key, ...artifact } = saved;
      return Response.json({ artifact }, { status: 201 });
    });
  } catch (error) {
    const limited = limitResponse(error);
    if (limited) return limited;
    return Response.json({ error: "入库失败，请重试。" }, { status: 500 });
  }
}
