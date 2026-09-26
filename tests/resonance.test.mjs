import test from "node:test";
import assert from "node:assert/strict";
import { createExperienceLinks, sparseExperienceLinks, strongestConnections } from "../lib/resonance.ts";

function moment(id, desc, overrides = {}) {
  return { id, desc, title: "《一张照片》", tag: "光学残片", isPublic: true, ...overrides };
}

test("links discarded design work to an unsent message across filing categories", () => {
  const links = createExperienceLinks([
    moment("canvas", "画布改到第八版，最后还是被废弃了。"),
    moment("message", "消息写完了，又删掉，最后什么都没发。", { tag: "未发字符" }),
  ]);
  assert.equal(links.length, 1);
  assert.equal(links[0].experienceId, "prepared-unreleased");
  assert.match(links[0].fromEvidence, /修改/);
  assert.match(links[0].toEvidence, /没有发出/);
});

test("connects saved-but-unopened content without conflating it with leftover food", () => {
  const links = createExperienceLinks([
    moment("page", "书页截图保存后再没看过。"),
    moment("note", "保存了一句话，再没打开备忘录。"),
    moment("coffee", "杯里剩了一口咖啡，没喝完就冷了。"),
  ]);
  assert.deepEqual(links.map(link => [link.from, link.to]), [["page", "note"]]);
});

test("connects a moving train to waiting at an elevator", () => {
  const links = createExperienceLinks([
    moment("train", "高铁上看着倒退的电线杆，发呆二十秒。"),
    moment("lift", "等电梯时，看着数字，忘了继续刷手机。"),
  ]);
  assert.equal(links[0]?.experienceId, "process-pause");
});

test("matching titles, tags, seed IDs and photos cannot manufacture a connection", () => {
  assert.equal(createExperienceLinks([
    moment("MOM-STEEL-2026-№0001", "随手拍了一张照片。", { title: "《废弃画布》" }),
    moment("MOM-STEEL-2026-№0005", "把手机放回口袋。", { title: "《删掉的消息》" }),
  ]).length, 0);
});

test("private moments never participate and selected neighbors are limited", () => {
  const items = Array.from({ length: 7 }, (_, i) => moment(String(i), "收藏了一篇文章，之后一直没看。"));
  items.push(moment("private", "收藏了一篇文章，之后一直没看。", { isPublic: false }));
  const links = createExperienceLinks(items);
  assert.ok(links.every(link => link.from !== "private" && link.to !== "private"));
  assert.equal(strongestConnections(links, "0").length, 3);
  const degree = new Map();
  for (const link of sparseExperienceLinks(links)) for (const id of [link.from, link.to]) degree.set(id, (degree.get(id) || 0) + 1);
  assert.ok([...degree.values()].every(value => value <= 3));
});
