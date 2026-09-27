import type { Artifact, ArtifactTag } from "@/lib/artifact";

// Authored exhibition scenarios, never represented as visitor submissions.
const scenarios: [string, string, ArtifactTag][] = [
  ["夕阳坐过的椅子", "下班回来，夕阳落在空椅子上。我看着那束光，等它慢慢移到地板。", "光学残片"],
  ["树影挪了半步", "等车时看着墙上的树影。车还没来，影子先挪了半步。", "生理宕机"],
  ["门口的水碗", "路过便利店，看见有人给门口的猫添了一碗水。猫喝了很久，那个人已经走了。", "物理停摆"],
  ["留在台阶上的面包", "把最后一小块面包留在台阶上喂鸟。走了几步又回头看，麻雀刚好落下来。", "物理停摆"],
  ["雨停以后", "雨停了，收起的伞还在滴水。楼下有人走过，鞋底带出几声短短的响。", "声学废料"],
  ["纸袋里的余温", "面包已经吃完，手还捏着温热的纸袋。到下一个路口，才把它折起来。", "物理停摆"],
  ["杯壁上的一点暖", "茶喝完了，双手还捧着温热的杯子。窗外天已经暗了，灯还没开。", "液体耗散"],
  ["自己听见的哼唱", "洗杯子时哼了半句歌，声音只留在厨房里。水停下来，才发现自己一直在唱。", "声学废料"],
  ["绕远的桂花", "回家路上闻到桂花，绕到另一条巷子。多走了几分钟，也没摘下一朵。", "生理宕机"],
  ["没有按下发送", "消息写完了，手指离开输入框，什么都没发。窗外的灯一盏一盏亮起来。", "未发字符"],
  ["停在草稿里的问候", "草稿里那句最近好吗，已经放了三个月。今天看见，还是没有发出去。", "未发字符"],
  ["书页里的一片叶子", "翻开旧书，一片夹平的叶子落下来。已经不记得是哪条路上捡的。", "光学残片"],
];

export const constellationSamples: Artifact[] = scenarios.map(([title, desc, tag], index) => ({
  id: `MOM-GRAPH-SAMPLE-${String(index + 1).padStart(4, "0")}`,
  title: `《${title}》`, desc, tag, isPublic: true,
  date: "日常展陈样本", createdAt: "2026-09-27T00:00:00.000Z",
  cot: ["本馆预置的现代生活情景", "用于呈现日常切片之间的共鸣", "情景样本，不代表真实用户投稿"],
  metrics: { gdpContribution: "0.0000%", entropyIncrease: "未计量" },
  appraisalConclusion: "没有新的结果，留下了一点生活的细节。准予展陈。",
}));

export function isConstellationSample(id: string) { return id.startsWith("MOM-GRAPH-SAMPLE-"); }
