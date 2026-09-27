import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export class SubmissionLimitError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function limitResponse(error: unknown): Response | null {
  return error instanceof SubmissionLimitError
    ? Response.json({ error: error.message, reason: "capacity" }, { status: error.status, headers: { "Retry-After": "30" } }) : null;
}
export function positiveLimit(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

// Shared across route bundles. Deployment must run one Node process for the JSON store.
type Gate = { active: number; waiting: Array<() => void>; budget: Promise<unknown> };
const shared = globalThis as typeof globalThis & { museumSubmissionGate?: Gate };
const gate = shared.museumSubmissionGate ??= { active: 0, waiting: [], budget: Promise.resolve() };

const submissions = new Map<string, Promise<Response>>();
export async function singleSubmission(key: string, work: () => Promise<Response>): Promise<Response> {
  const pending = submissions.get(key);
  if (pending) return (await pending).clone();
  if (submissions.size >= 24) throw new SubmissionLimitError(429, "现在投稿的人较多，请稍后再试。");
  const task = work();
  submissions.set(key, task);
  try { return (await task).clone(); }
  finally { submissions.delete(key); }
}

async function reserveCall(): Promise<void> {
  const task = gate.budget.then(async () => {
    const file = path.join(process.cwd(), "data", "model-budget.json");
    const day = new Date().toISOString().slice(0, 10);
    let count = 0;
    try {
      const value: unknown = JSON.parse(await readFile(file, "utf8"));
      if (!value || typeof value !== "object") throw new Error("Invalid budget");
      const record = value as { day?: unknown; count?: unknown };
      if (typeof record.day !== "string" || !Number.isSafeInteger(record.count) || Number(record.count) < 0) throw new Error("Invalid budget");
      if (record.day === day) count = Number(record.count);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new SubmissionLimitError(503, "投稿额度记录暂时不可用，请稍后重试。");
    }
    if (count >= positiveLimit("SUBMISSION_MODEL_DAILY_LIMIT", 1000)) throw new SubmissionLimitError(429, "今天的投稿处理额度已用完，请明天再来。");
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify({ day, count: count + 1 }), { mode: 0o600 });
    await rename(temporary, file);
  });
  gate.budget = task.catch(() => undefined);
  await task;
}

export async function guardedModelCall<T>(work: () => Promise<T>): Promise<T> {
  const concurrency = positiveLimit("SUBMISSION_MODEL_CONCURRENCY", 1);
  if (gate.active >= concurrency) {
    if (gate.waiting.length >= positiveLimit("SUBMISSION_MODEL_QUEUE_LIMIT", 12)) throw new SubmissionLimitError(429, "现在投稿的人较多，请稍后再试，内容尚未入库。");
    await new Promise<void>((resolve, reject) => {
      const ready = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => {
        const index = gate.waiting.indexOf(ready);
        if (index >= 0) gate.waiting.splice(index, 1);
        reject(new SubmissionLimitError(503, "投稿等待超时，请稍后重试。"));
      }, 45000);
      gate.waiting.push(ready);
    });
  } else gate.active++;
  try { await reserveCall(); return await work(); }
  finally {
    const next = gate.waiting.shift();
    if (next) next(); else gate.active--;
  }
}

/** Bound actual streamed bytes, including requests without Content-Length. */
export async function readSubmissionJSON(request: Request): Promise<unknown> {
  const max = 2 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > max) throw new SubmissionLimitError(413, "投稿内容过大，请缩小照片后再试。");
  if (!request.body) throw new SubmissionLimitError(400, "投稿内容为空。");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new SubmissionLimitError(413, "投稿内容过大，请缩小照片后再试。"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new SubmissionLimitError(400, "投稿格式不正确。"); }
}
