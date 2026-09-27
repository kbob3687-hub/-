let sequence = 0;

/** Retry identity, never a login credential. getRandomValues also works on HTTP. */
export function createSubmissionKey(source: Pick<Crypto, "getRandomValues"> | undefined = globalThis.crypto): string {
  if (source && typeof source.getRandomValues === "function") {
    const bytes = source.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  }
  // Older browsers without Web Crypto still need to be able to submit.
  return `submission-${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}`;
}
