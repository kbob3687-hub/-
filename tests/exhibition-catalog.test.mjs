import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { createExperienceLinks } from "../lib/resonance.ts";

// Compile the actual modules in memory to resolve Next's @ alias without writing
// into the live catalogue or a temporary data store.
async function moduleUrl(name, imports = {}) {
  const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  let code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [specifier, url] of Object.entries(imports)) code = code.replaceAll(`"${specifier}"`, `"${url}"`);
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}
const artifactUrl = await moduleUrl("artifact");
const sampleUrl = await moduleUrl("constellation-samples");
const { createExhibitionCatalog, hasExhibitionDetail, EXHIBITION_BATCH_SIZE } = await import(await moduleUrl("exhibition-catalog", { "@/lib/artifact": artifactUrl, "@/lib/constellation-samples": sampleUrl }));
const { constellationSamples } = await import(sampleUrl);
const record = (id, desc, extra = {}) => ({ id, desc, title: "《一件小事》", isPublic: true, ...extra });

test("detail-free summaries leave both views without deleting or rewriting submissions", () => {
  const hidden = ["白等了一会", "白等了一会啥也没干", "聊天很久啥也没干", "跟颜校聊了很久", "和朋友讨论项目", "喝了很多水", "吃饭很多"];
  const records = hidden.map((text, i) => record(`bare-${i}`, text));
  records.push(record("cat", "来的路上看到有人喂猫"), record("short", "雨落在杯里"), record("positive", "今天很开心，坐在窗边看着阳光移到桌上。"), record("private", "看着夕阳", { isPublic: false }));
  const before = JSON.stringify(records);
  const catalog = createExhibitionCatalog(records);
  assert.ok(hidden.every((_text, i) => !catalog.some(item => item.id === `bare-${i}`)));
  assert.ok(["cat", "short", "positive"].every(id => catalog.some(item => item.id === id)));
  assert.ok(!catalog.some(item => item.id === "private"));
  assert.equal(JSON.stringify(records), before);
  assert.equal(hasExhibitionDetail(record("specific-wait", "白等了一会，看见墙上的树影挪了半步。")), true);
  assert.equal(hasExhibitionDetail(record("image-short-caption", "聊天很久啥也没干", { imageUrl: "data:image/png;base64,aGVsbG8=" })), true);
  assert.equal(hasExhibitionDetail(record("image-test-title", "今天骑车拍到的", { title: "《测》", imageUrl: "data:image/png;base64,aGVsbG8=" })), true);
});

test("curated catalogue is unique, gentler and still connects genuine details", () => {
  const cat = record("cat", "来的路上看到有人喂猫");
  const catalog = createExhibitionCatalog([cat, cat]);
  assert.equal(EXHIBITION_BATCH_SIZE, 6);
  assert.equal(constellationSamples.length, 12);
  assert.equal(catalog.length, 21);
  assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
  assert.ok(catalog.slice(0, 6).some(item => item.title === "《夕阳坐过的椅子》"));
  const links = createExperienceLinks(catalog);
  assert.ok(links.some(link => link.experienceId === "light-pause"));
  assert.ok(links.some(link => link.experienceId === "warmth-remains"));
  assert.ok(links.some(link => link.experienceId === "small-care" && (link.from === "cat" || link.to === "cat")));
  assert.equal(createExperienceLinks([record("a", "今天心情很好。"), record("b", "今天也很开心。")]).length, 0);
});
