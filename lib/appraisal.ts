import { guardedModelCall, SubmissionLimitError } from "@/lib/submission-guard";
import { ArtifactDraft, isArtifactTag } from "@/lib/artifact";
import { AppraisalInput, offlineAppraisal } from "@/lib/offline-appraisal";

export async function appraise(input: AppraisalInput): Promise<{ draft: ArtifactDraft; source: "ai" | "offline" }> {
  const fallback = offlineAppraisal(input);
  if (process.env.IS_OFFLINE_DEMO === "true" || !process.env.AI_API_KEY || !process.env.AI_MODEL) {
    return { draft: fallback, source: "offline" };
  }

  try {
    const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const response = await guardedModelCall(() => fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        temperature: 0.7,
        max_tokens: 1000,
        reasoning_effort: "none",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "你是《无意义博物馆》的编目官。根据用户真实小事生成庄重、克制、略带幽默的馆藏鉴定。只返回 JSON，字段：title（《》中的中文标题，最多20字）、tag（必须是：液体耗散、声学废料、未发字符、生理宕机、光学残片、物理停摆之一）、cot（恰好3句简短公开的策展观察文案，不是模型内部思维过程）、appraisalConclusion（最多35字）。标题要抓住原话里的具体物件、动作或时间；三句文案应从可见细节出发，保留解释空间。不要反复套用生产力、价值、熵增等抽象词。不得增加用户未提供的事实，不得替用户断言心情或动机，不得编造具体物理数值或官方认证；避免鸡汤、嘲讽和心理诊断。",
          },
          { role: "user", content: `原始记录：${input.desc}\n投稿标题：${input.title || "无"}` },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    }));
    if (!response.ok) throw new Error(`Model returned ${response.status}`);
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Missing model content");
    const result = JSON.parse(content) as Partial<ArtifactDraft>;
    if (!result.title || !result.tag || !isArtifactTag(result.tag) || !Array.isArray(result.cot) || result.cot.length !== 3 || !result.appraisalConclusion) {
      throw new Error("Invalid model response");
    }
    return {
      draft: {
        ...fallback,
        title: String(result.title).slice(0, 42),
        tag: result.tag,
        cot: result.cot.map((step) => String(step).slice(0, 90)),
        appraisalConclusion: String(result.appraisalConclusion).slice(0, 90),
      },
      source: "ai",
    };
  } catch (error) {
    if (error instanceof SubmissionLimitError) throw error;
    return { draft: fallback, source: "offline" };
  }
}
