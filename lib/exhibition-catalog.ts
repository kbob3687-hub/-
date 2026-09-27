import { seedArtifacts, type Artifact } from "@/lib/artifact";
import { constellationSamples, isConstellationSample } from "@/lib/constellation-samples";

const seedIds = new Set(seedArtifacts.map(item => item.id));
export const EXHIBITION_BATCH_SIZE = 6;

export function isExhibitionSample(id: string) {
  return seedIds.has(id) || isConstellationSample(id);
}

// Hide detail-free summaries only from exhibition; never rewrite or delete records.
// A tiny but concrete detail (even a short one) is welcome: length isn't quality.
export function hasExhibitionDetail(item: Artifact): boolean {
  // A visitor's photo is itself evidence; a short caption must not hide it.
  if (item.imageUrl?.trim()) return true;
  const text = item.desc.replace(/[\s，。！？、；：,.!?;:～~]/g, "");
  const title = item.title.replace(/[《》\s]/g, "");
  if (/^(测|测试|test|测试投稿)$/i.test(title)) return false;
  return ![
    /^白?等了?(一会儿?|很久|半天)(啥也没干|什么也没干|什么都没干)?$/,
    /^(跟|和)?.{0,8}聊(天)?了?(很久|一会儿?)(啥也没干|什么也没干|什么都没干)?$/,
    /^(和|跟)?.{0,8}(讨论|聊)(了)?(项目|工作)(很久|一会儿?)?$/,
    /^(吃饭|吃了饭|喝水|喝了水|喝了很多水|吃饭很多|发呆|啥也没干|什么也没干|什么都没干)$/,
  ].some(pattern => pattern.test(text));
}

// Both exhibition views and detail links share this curated catalogue.
export function createExhibitionCatalog(artifacts: Artifact[]): Artifact[] {
  const seen = new Set<string>();
  const submissions = artifacts.filter(item => !isExhibitionSample(item.id) && item.isPublic && hasExhibitionDetail(item));
  // Fresh submissions keep their entrance, with gentle authored moments in the
  // first screen rather than 28 repetitive filler nodes. Samples stay labelled.
  return [...submissions.slice(0, 2), ...constellationSamples.slice(0, 4), ...submissions.slice(2), ...seedArtifacts, ...constellationSamples.slice(4)].filter(item => {
    if (!item.isPublic || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
