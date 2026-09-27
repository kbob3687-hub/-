import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";

test("catalogue cache refreshes after a submission and external replacement", async () => {
  // Exercise the real store in a separate process and disposable directory.
  // No write touches the development server's catalogue.
  const directory = await mkdtemp(join(tmpdir(), "museum-store-cache-"));
  try {
    for (const name of ["artifact", "submission-guard", "store"]) {
      const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
      const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText.replace('"@/lib/artifact"', '"./artifact.mjs"').replace('"@/lib/submission-guard"', '"./submission-guard.mjs"');
      await writeFile(join(directory, `${name}.mjs`), compiled);
    }
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      import { writeFile, rename } from 'node:fs/promises';
      import { readPublicArtifactSnapshot, saveArtifact } from './store.mjs';
      const initial = await readPublicArtifactSnapshot();
      assert.strictEqual(await readPublicArtifactSnapshot(), initial);
      const artifact = await saveArtifact({
        title: '《一次等待》', desc: '等车的时候发了一会呆。', tag: '物理停摆',
        cot: ['等待', '发呆', '没有产出'], appraisalConclusion: '准予封存',
        metrics: { gdpContribution: '0', entropyIncrease: '拟制' }, isPublic: true,
      });
      const added = await readPublicArtifactSnapshot();
      assert.notEqual(added.etag, initial.etag);
      assert.ok(JSON.parse(added.body).artifacts.some(item => item.id === artifact.id));
      assert.strictEqual(await readPublicArtifactSnapshot(), added);
      await writeFile('data/replacement.json', JSON.stringify([{ ...artifact, desc: '等车时看着路口发呆。' }]));
      await rename('data/replacement.json', 'data/artifacts.json');
      const replaced = await readPublicArtifactSnapshot();
      assert.notEqual(replaced.etag, added.etag);
      assert.equal(JSON.parse(replaced.body).artifacts.find(item => item.id === artifact.id).desc, '等车时看着路口发呆。');
    `], { cwd: directory, encoding: "utf8", timeout: 15000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
