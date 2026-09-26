import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { Artifact, ArtifactDraft, makeArtifact, seedArtifacts } from "@/lib/artifact";

const dataPath = path.join(process.cwd(), "data", "artifacts.json");
const seedIds = new Set(seedArtifacts.map((artifact) => artifact.id));
let writeQueue: Promise<unknown> = Promise.resolve();
type PublicSnapshot = { body: string; etag: string };
let publicCache: { revision: string; snapshot: Promise<PublicSnapshot> } | undefined;

export async function readPublicArtifactSnapshot(): Promise<PublicSnapshot> {
  let revision: string;
  try {
    const info = await stat(dataPath, { bigint: true });
    revision = `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    revision = "seeds-only";
  }
  // Polling unchanged data only stats the file: no reread, JSON parse or hash.
  // Atomic replacement and external edits both invalidate this snapshot.
  if (publicCache?.revision === revision) return publicCache.snapshot;
  const snapshot = readArtifacts().then(artifacts => {
    const body = JSON.stringify({ artifacts: artifacts.filter(item => item.isPublic) });
    const etag = `W/"${createHash("sha256").update(body).digest("hex")}"`;
    return { body, etag };
  });
  const entry = { revision, snapshot };
  publicCache = entry;
  try { return await snapshot; }
  catch (error) {
    if (publicCache === entry) publicCache = undefined;
    throw error;
  }
}

export async function readArtifacts(): Promise<Artifact[]> {
  try {
    const raw = await readFile(dataPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? [...(parsed as Artifact[]).filter((artifact) => !seedIds.has(artifact.id)), ...seedArtifacts]
      : seedArtifacts;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return seedArtifacts;
    throw error;
  }
}

export async function saveArtifact(draft: ArtifactDraft): Promise<Artifact> {
  const task = writeQueue.then(async () => {
    const existing = await readArtifacts();
    const maxSequence = existing.reduce((max, item) => {
      const match = item.id.match(/№(\d+)$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);
    const artifact = makeArtifact(draft, maxSequence + 1);
    await mkdir(path.dirname(dataPath), { recursive: true });
    const tempPath = `${dataPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    const submissions = existing.filter((item) => !seedIds.has(item.id));
    await writeFile(tempPath, JSON.stringify([artifact, ...submissions], null, 2), "utf8");
    await rename(tempPath, dataPath);
    return artifact;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}
