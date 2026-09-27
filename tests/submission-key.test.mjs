import test from "node:test";
import assert from "node:assert/strict";
import { createSubmissionKey } from "../lib/submission-key.ts";

test("HTTP browser without randomUUID can generate a valid retry identity", () => {
  const source = { getRandomValues: bytes => { bytes.fill(17); return bytes; } };
  assert.equal(createSubmissionKey(source), "11".repeat(16));
});

test("older browsers without crypto generate distinct valid keys", () => {
  const keys = Array.from({ length: 1000 }, () => createSubmissionKey(null));
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.every(key => /^[A-Za-z0-9_-]{1,128}$/.test(key)));
});
