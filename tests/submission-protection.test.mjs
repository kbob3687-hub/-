import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";

test("submission protection bounds concurrency, quota, retries and storage without touching real data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "museum-protection-"));
  try {
    for (const name of ["artifact", "submission-guard", "store", "submission-review", "image-policy", "http-etag"]) {
      const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
      const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
        .replace('"@/lib/artifact"', '"./artifact.mjs"').replace('"@/lib/submission-guard"', '"./submission-guard.mjs"').replace('"./submission-guard"', '"./submission-guard.mjs"');
      await writeFile(join(directory, `${name}.mjs`), compiled);
    }
    const routeSource = await readFile(new URL("../app/api/artifacts/route.ts", import.meta.url), "utf8");
    const route = ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/"@\/lib\/([^"\s]+)"/g, '"./$1.mjs"');
    await writeFile(join(directory, "route.mjs"), route);
    const run = script => spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: directory, encoding: "utf8", timeout: 15000 });
    const result = run(`
      import assert from 'node:assert/strict';
      import { readFile } from 'node:fs/promises';
      import { guardedModelCall, readSubmissionJSON, singleSubmission } from './submission-guard.mjs';
      import { saveArtifact, readPublicArtifactSnapshot } from './store.mjs';
      process.env.SUBMISSION_MODEL_CONCURRENCY = '1';
      process.env.SUBMISSION_MODEL_QUEUE_LIMIT = '1';
      process.env.SUBMISSION_MODEL_DAILY_LIMIT = '2';
      let release;
      const first = guardedModelCall(() => new Promise(resolve => { release = resolve; }));
      while (!release) await new Promise(resolve => setTimeout(resolve, 1));
      let secondStarted = false;
      const second = guardedModelCall(async () => { secondStarted = true; return 2; });
      await assert.rejects(guardedModelCall(async () => 3), error => error.status === 429);
      assert.equal(secondStarted, false);
      release(1);
      assert.deepEqual(await Promise.all([first, second]), [1, 2]);
      await assert.rejects(guardedModelCall(async () => 3), error => error.status === 429);
      assert.equal(JSON.parse(await readFile('data/model-budget.json')).count, 2);
      await assert.rejects(readSubmissionJSON(new Request('http://test', { method: 'POST', body: 'invalid' })), error => error.status === 400);
      await assert.rejects(readSubmissionJSON(new Request('http://test', { method: 'POST', body: 'x'.repeat(2097153) })), error => error.status === 413);
      let executions = 0;
      const work = async () => { executions++; await new Promise(resolve => setTimeout(resolve, 10)); return Response.json({ ok: true }); };
      const responses = await Promise.all([singleSubmission('same', work), singleSubmission('same', work)]);
      assert.equal(executions, 1);
      for (const response of responses) assert.deepEqual(await response.json(), { ok: true });
      const draft = { title: '云', desc: '坐在窗边看云', tag: '物理停摆', cot: ['一', '二', '三'], appraisalConclusion: '封存', metrics: { gdpContribution: '0', entropyIncrease: '未计量' }, isPublic: true };
      const saved = await Promise.all([saveArtifact(draft, 'retry'), saveArtifact(draft, 'retry')]);
      assert.equal(saved[0].id, saved[1].id);
      const raw = JSON.parse(await readFile('data/artifacts.json'));
      assert.equal(raw.length, 1);
      assert.ok(!(await readPublicArtifactSnapshot()).body.includes('submissionKey'));
      process.env.SUBMISSION_ARCHIVE_MAX_COUNT = '1';
      await assert.rejects(saveArtifact(draft, 'new'), error => error.status === 507);
      process.env.SUBMISSION_ARCHIVE_MAX_COUNT = '5000';
      process.env.SUBMISSION_ARCHIVE_MAX_BYTES = '1';
      await assert.rejects(saveArtifact(draft, 'new'), error => error.status === 507);
      assert.deepEqual(JSON.parse(await readFile('data/artifacts.json')), raw);
    `);
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    const integration = run(`
      import assert from 'node:assert/strict';
      import { readFile } from 'node:fs/promises';
      import { POST } from './route.mjs';
      process.env.CONTENT_REVIEW_MODEL = 'test';
      process.env.CONTENT_REVIEW_API_KEY = 'synthetic';
      process.env.CONTENT_REVIEW_BASE_URL = 'https://test.invalid';
      let calls = 0;
      let allowed = true;
      globalThis.fetch = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return Response.json({ choices: [{ message: { content: JSON.stringify({ safety: allowed ? 'allow' : 'reject', theme: 'allow' }) } }] }); };
      const draft = { title: '树影', desc: '看着树影挪了半步', tag: '物理停摆', cot: ['一', '二', '三'], appraisalConclusion: '封存', metrics: { gdpContribution: '0', entropyIncrease: '未计量' }, isPublic: true };
      const request = body => new Request('http://test/api/artifacts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'session-123' }, body: JSON.stringify(body) });
      const responses = await Promise.all([POST(request(draft)), POST(request(draft))]);
      const ids = await Promise.all(responses.map(async response => { assert.equal(response.status, 201); return (await response.json()).artifact.id; }));
      assert.equal(ids[0], ids[1]);
      assert.equal(calls, 1);
      const retry = await POST(request(draft));
      assert.equal(retry.status, 200);
      assert.equal(calls, 1);
      allowed = false;
      assert.equal((await POST(request({ ...draft, desc: '修改过的另一段记录' }))).status, 422);
      assert.equal(calls, 2);
      const raw = JSON.parse(await readFile('data/artifacts.json'));
      assert.equal(raw.length, 2);
      process.env.SUBMISSION_ARCHIVE_MAX_COUNT = '2';
      assert.equal((await POST(request({ ...draft, desc: '第三段新的记录' }))).status, 507);
      assert.equal(calls, 2);
      assert.equal((await POST(new Request('http://test', { method: 'POST', body: 'oops' }))).status, 400);
    `);
    assert.equal(integration.status, 0, integration.stderr);
    const restarted = run(`
      import assert from 'node:assert/strict';
      import { guardedModelCall } from './submission-guard.mjs';
      process.env.SUBMISSION_MODEL_DAILY_LIMIT = '2';
      await assert.rejects(guardedModelCall(async () => { throw new Error('must not call provider'); }), error => error.status === 429);
    `);
    assert.equal(restarted.status, 0, restarted.stderr);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
