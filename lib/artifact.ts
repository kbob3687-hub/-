export const TAGS = [
  "液体耗散",
  "声学废料",
  "未发字符",
  "生理宕机",
  "光学残片",
  "物理停摆",
] as const;

export type ArtifactTag = (typeof TAGS)[number];

export interface Artifact {
  id: string;
  title: string;
  tag: ArtifactTag;
  desc: string;
  date: string;
  createdAt: string;
  isPublic: boolean;
  cot: string[];
  metrics: {
    gdpContribution: string;
    entropyIncrease: string;
  };
  appraisalConclusion: string;
  imageUrl?: string;
  reflection?: string;
}

export type ArtifactDraft = Pick<Artifact, "title" | "tag" | "desc" | "cot" | "metrics" | "appraisalConclusion" | "imageUrl" | "isPublic">;

export function displayArtifactId(id: string): string {
  return id.replace(/^MOM-STEEL-/, "MOM-");
}

export const seedArtifacts: Artifact[] = [
  {
    id: "MOM-STEEL-2026-№0001",
    title: "《第八版废弃画布》",
    tag: "光学残片",
    desc: "Figma 画布改到第八版，最后还是被废弃了。",
    date: "09.25 / 15:42",
    createdAt: "2026-09-25T07:42:00.000Z",
    isPublic: true,
    cot: ["同一画布经历八次修改", "第八版仍被废弃", "这些像素没有进入最终作品"],
    metrics: { gdpContribution: "0.0000%", entropyIncrease: "未计量" },
    appraisalConclusion: "未投入使用的八次认真。准予封存。",
    imageUrl: "/exhibits/abandoned-canvas.webp",
  },
  {
    id: "MOM-STEEL-2026-№0002",
    title: "《凌晨两点的辣油》",
    tag: "液体耗散",
    desc: "凌晨两点，外卖盒角落的辣油已经凝住了。",
    date: "09.25 / 16:08",
    createdAt: "2026-09-25T08:08:00.000Z",
    isPublic: true,
    cot: ["一份外卖留下少量辣油", "时间让它慢慢凝固", "没有新的用途出现"],
    metrics: { gdpContribution: "0.0000%", entropyIncrease: "未计量" },
    appraisalConclusion: "一小块凝固的夜晚。准予封存。",
    imageUrl: "/exhibits/midnight-takeout.webp",
  },
  {
    id: "MOM-STEEL-2026-№0003",
    title: "《再没翻开的那一页》",
    tag: "光学残片",
    desc: "手机相册里，那张书页截图保存后再没看过。",
    date: "09.25 / 16:21",
    createdAt: "2026-09-25T08:21:00.000Z",
    isPublic: true,
    cot: ["一页书被截取", "图像进入手机相册", "此后没有再被打开"],
    metrics: { gdpContribution: "0.0000%", entropyIncrease: "未计量" },
    appraisalConclusion: "一次认真保存过的遗忘。准予封存。",
    imageUrl: "/exhibits/forgotten-screenshot.webp",
  },
  {
    id: "MOM-STEEL-2026-№0004",
    title: "《倒退的电线杆》",
    tag: "生理宕机",
    desc: "赶高铁时，我看着窗外倒退的电线杆，发了 20 秒呆。",
    date: "09.25 / 16:37",
    createdAt: "2026-09-25T08:37:00.000Z",
    isPublic: true,
    cot: ["列车仍在前进", "电线杆从视野里后退", "二十秒没有被安排给任何任务"],
    metrics: { gdpContribution: "0.0000%", entropyIncrease: "未计量" },
    appraisalConclusion: "一次不耽误行程的走神。准予封存。",
    imageUrl: "/exhibits/train-window.webp",
  },
  {
    id: "MOM-STEEL-2026-№0005",
    title: "《输入框里的“算了”》",
    tag: "未发字符",
    desc: "消息写了“算了”，又全部删掉，最后什么都没发。",
    date: "09.25 / 16:49",
    createdAt: "2026-09-25T08:49:00.000Z",
    isPublic: true,
    cot: ["两个字曾短暂出现", "两个字随后被删除", "接收端保持安静"],
    metrics: { gdpContribution: "0.0000%", entropyIncrease: "未计量" },
    appraisalConclusion: "一条未抵达的消息。准予封存。",
  },
  {
    id: "MOM-STEEL-2026-№0006",
    title: "《电梯还在十二楼》",
    tag: "物理停摆",
    desc: "等电梯时，数字停在十二楼。我看着它，忘了继续刷手机。",
    date: "09.25 / 17:02",
    createdAt: "2026-09-25T09:02:00.000Z",
    isPublic: true,
    cot: ["电梯暂时停在十二楼", "等待者把目光交给数字", "手机屏幕没有得到下一次滑动"],
    metrics: { gdpContribution: "0.0000%", entropyIncrease: "未计量" },
    appraisalConclusion: "一次没有被填满的等待。准予封存。",
  },
  {
    id: "MOM-STEEL-2026-№0007",
    title: "《暂停后还在响的副歌》",
    tag: "声学废料",
    desc: "耳机已经摘了，刚才那半句副歌还在脑子里循环。",
    date: "09.25 / 17:16",
    createdAt: "2026-09-25T09:16:00.000Z",
    isPublic: true,
    cot: ["播放已经结束", "听觉记忆仍在重复", "这一小段声音没有新的听众"],
    metrics: { gdpContribution: "0.0000%", entropyIncrease: "未计量" },
    appraisalConclusion: "耳机之外的半首歌。准予封存。",
  },
  {
    id: "MOM-STEEL-2026-№0008",
    title: "《提前五分钟的闹钟》",
    tag: "生理宕机",
    desc: "我把闹钟提前了五分钟，醒来后还是多躺了十分钟。",
    date: "09.25 / 17:31",
    createdAt: "2026-09-25T09:31:00.000Z",
    isPublic: true,
    cot: ["闹钟被提前五分钟", "起床又推迟了十分钟", "时间安排没有达到预期"],
    metrics: { gdpContribution: "0.0000%", entropyIncrease: "未计量" },
    appraisalConclusion: "一次没有改变早晨的校准。准予封存。",
  },
];

export function isArtifactTag(value: string): value is ArtifactTag {
  return TAGS.includes(value as ArtifactTag);
}

export function makeArtifact(draft: ArtifactDraft, sequence: number): Artifact {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "00";
  return {
    ...draft,
    id: `MOM-${now.getFullYear()}-№${String(sequence).padStart(4, "0")}`,
    date: `${part("month")}.${part("day")} / ${part("hour")}:${part("minute")}`,
    createdAt: now.toISOString(),
  };
}
