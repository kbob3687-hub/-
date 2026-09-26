import { isArchiveImage } from "@/lib/image-policy";
import { TAGS, type Artifact } from "@/lib/artifact";

const DATABASE_NAME = "museum-of-meaninglessness-private";
const STORE_NAME = "artifacts";
const LEGACY_KEY = "mom-private-artifacts";
export const PRIVATE_ARCHIVE_CHANGED = "mom-private-archive-changed";
let databasePromise: Promise<IDBDatabase> | null = null;

function storageError(reason: unknown, fallback: string) {
  const name = reason instanceof Error || reason instanceof DOMException ? reason.name : "";
  if (name === "QuotaExceededError") return new Error("此浏览器的本机存储空间不足，记录尚未保存。请保留当前内容，释放空间后重试。");
  if (name === "SecurityError" || name === "NotAllowedError") return new Error("此浏览器禁止保存本机档案。请在允许存储的普通浏览器中打开同一入口，再提交；深库不会跨浏览器同步。");
  return new Error(fallback, { cause: reason });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(storageError(transaction.error, "本机深库操作中断，请重试。"));
    transaction.onerror = () => reject(storageError(transaction.error, "本机深库操作失败，请重试。"));
  });
}

function isPersonalArtifact(value: unknown): value is Artifact {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Artifact>;
  return typeof item.isPublic === "boolean" && typeof item.id === "string" && typeof item.createdAt === "string" &&
    typeof item.title === "string" && typeof item.desc === "string" && Array.isArray(item.cot) && Boolean(item.metrics);
}

async function migrateLegacy(db: IDBDatabase) {
  let raw: string | null;
  try { raw = localStorage.getItem(LEGACY_KEY); }
  catch { return; }
  if (!raw) return;

  let records: unknown;
  try { records = JSON.parse(raw); }
  catch { return; }
  if (!Array.isArray(records)) return;

  const transaction = db.transaction(STORE_NAME, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(STORE_NAME);
  for (const item of records) if (isPersonalArtifact(item) && !item.isPublic) store.put(item);
  await done;
  try { localStorage.removeItem(LEGACY_KEY); }
  catch { /* A completed migration is still available in IndexedDB. */ }
}

function openPrivateArchive(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("此浏览器无法使用本机深库。"));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onerror = () => reject(storageError(request.error, "本机深库无法打开，请重试。"));
    request.onblocked = () => reject(new Error("本机深库正在被其他页面占用，请关闭其他页面后重试。"));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); databasePromise = null; };
      db.onclose = () => { databasePromise = null; };
      void migrateLegacy(db).then(() => resolve(db), (error) => { db.close(); reject(error); });
    };
  }).catch((error) => { databasePromise = null; throw error; });
  return databasePromise;
}

export async function savePersonalArtifact(artifact: Artifact) {
  if (!isPersonalArtifact(artifact)) throw new Error("本机档案格式不完整，无法保存。");
  const db = await openPrivateArchive();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(STORE_NAME).put(artifact);
  await done;
  // A receipt must not claim success before the committed record can be read back.
  const verification = db.transaction(STORE_NAME, "readonly");
  const verified = transactionDone(verification);
  const request = verification.objectStore(STORE_NAME).get(artifact.id);
  const record = await new Promise<Artifact | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(storageError(request.error, "记录保存后无法核验，请重试。"));
  }).catch(async (reason) => { await verified.catch(() => {}); throw reason; });
  await verified;
  if (!record || record.desc !== artifact.desc || record.imageUrl !== artifact.imageUrl) {
    throw new Error("未能确认本机档案保存成功，请保留当前内容后重试。");
  }
  window.dispatchEvent(new Event(PRIVATE_ARCHIVE_CHANGED));
}

export async function listPersonalArtifacts(): Promise<Artifact[]> {
  const db = await openPrivateArchive();
  const transaction = db.transaction(STORE_NAME, "readonly");
  const done = transactionDone(transaction);
  const request = transaction.objectStore(STORE_NAME).openCursor();
  const records = await new Promise<Artifact[]>((resolve, reject) => {
    const items: Artifact[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { resolve(items); return; }
      if (isPersonalArtifact(cursor.value)) items.push(cursor.value);
      cursor.continue();
    };
    request.onerror = () => reject(storageError(request.error, "无法读取本机深库，请重试。"));
  }).catch(async (reason) => { await done.catch(() => {}); throw reason; });
  await done;
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function isImportableArtifact(value: unknown): value is Artifact {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Artifact>;
  return typeof item.isPublic === "boolean" &&
    typeof item.id === "string" && item.id.length > 0 && item.id.length <= 100 &&
    typeof item.title === "string" && item.title.length > 0 && item.title.length <= 100 &&
    typeof item.desc === "string" && item.desc.length >= 4 && item.desc.length <= 280 &&
    typeof item.tag === "string" && TAGS.includes(item.tag as Artifact["tag"]) &&
    typeof item.date === "string" && typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt)) &&
    Array.isArray(item.cot) && item.cot.length === 3 && item.cot.every((step) => typeof step === "string" && step.length <= 90) &&
    typeof item.appraisalConclusion === "string" && item.appraisalConclusion.length <= 100 &&
    typeof item.metrics?.gdpContribution === "string" && typeof item.metrics?.entropyIncrease === "string" &&
    (item.imageUrl === undefined || isArchiveImage(item.imageUrl)) &&
    (item.reflection === undefined || (typeof item.reflection === "string" && item.reflection.length <= 500));
}

export async function importPrivateArchive(payload: unknown): Promise<number> {
  if (!payload || typeof payload !== "object") throw new Error("这不是本馆的深库备份文件。");
  const backup = payload as { format?: unknown; version?: unknown; artifacts?: unknown };
  if (backup.format !== "mom-private-archive" || backup.version !== 1 || !Array.isArray(backup.artifacts) || backup.artifacts.length > 500 || !backup.artifacts.every(isImportableArtifact)) {
    throw new Error("备份文件格式不正确，未导入任何内容。");
  }
  const existingIds = new Set((await listPersonalArtifacts()).map((artifact) => artifact.id));
  const additions = (backup.artifacts as Artifact[]).filter((artifact) => {
    if (existingIds.has(artifact.id)) return false;
    existingIds.add(artifact.id);
    return true;
  });
  if (additions.length === 0) return 0;
  const db = await openPrivateArchive();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  for (const artifact of additions) store.put(artifact);
  await transactionDone(transaction);
  window.dispatchEvent(new Event(PRIVATE_ARCHIVE_CHANGED));
  return additions.length;
}
