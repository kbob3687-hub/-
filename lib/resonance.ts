import type { Artifact } from "@/lib/artifact";

export const resonanceThemes = [
  { id: "unspoken", name: "交出之前", number: "01" },
  { id: "undone", name: "计划之外", number: "02" },
  { id: "leftbehind", name: "结束以后", number: "03" },
  { id: "pause", name: "过程中的停顿", number: "04" },
] as const;
export type ResonanceThemeId = (typeof resonanceThemes)[number]["id"];
type Evidence = { kind: string; action: string };
type Experience = {
  id: string; theme: ResonanceThemeId; label: string; reason: string;
  read: (text: string) => Evidence | null;
};
const experiences: Experience[] = [
  {
    id: "prepared-unreleased", theme: "unspoken", label: "准备过，没有交出去",
    reason: "它们都描述了交出之前的准备，以及最后没有交出的结果。",
    read: text => {
      if (/消息|输入框|草稿|问候|晚安|句号/.test(text) && /写|打了|打字|草稿/.test(text) && /没发|未发|未发送|没有.*发送|没.*发送|删掉|删除|全.*删|草稿里/.test(text)) return { kind: "文字", action: "写下了内容，却没有发出" };
      if (/画布|文件|版本|配色|图标|设计/.test(text) && /改|修改|画布|挪齐/.test(text) && /废弃|作废|撤销|换回|没.*采用/.test(text)) return { kind: "修改", action: "留下了修改，却没有采用" };
      return null;
    },
  },
  {
    id: "saved-unopened", theme: "leftbehind", label: "留给以后，再没打开",
    reason: "两段原话都提到留下了一份内容，之后没有再查看或已经忘记。",
    read: text => /截图|收藏|相册|备忘录|保存/.test(text) && /没看|没.*看|没打开|没.*打开|忘|遗忘/.test(text)
      ? { kind: /备忘录/.test(text) ? "备忘录" : /收藏/.test(text) ? "收藏" : "截图", action: "留下了内容，之后没有再查看或已经忘记" } : null,
  },
  {
    id: "residue-after", theme: "leftbehind", label: "事情结束，东西还在",
    reason: "原话里的食物或饮料，都在日常过程结束以后留下了剩余。",
    read: text => /外卖|咖啡|奶茶|杯|辣油|糖浆/.test(text) && /剩|没喝完|凝|冷了|冷掉/.test(text)
      ? { kind: /咖啡/.test(text) ? "咖啡" : /奶茶|糖浆/.test(text) ? "奶茶" : "外卖", action: "留下了未被消耗完的东西" } : null,
  },
  {
    id: "process-pause", theme: "pause", label: "过程在继续，注意力停下",
    reason: "两件事都发生在行进或等待之中，原话留下了一次看着、走神或发呆的停顿。",
    read: text => /高铁|列车|地铁|电梯|等车|等.*水|等待|水烧开|开会前|路口/.test(text) && /发呆|走神|忘|看着|盯着|空白|没有.*话|没有一句/.test(text)
      ? { kind: /高铁|列车|地铁/.test(text) ? "行进" : "等待", action: "过程仍在进行，中间留下了一次停顿" } : null,
  },
  {
    id: "plan-diverged", theme: "undone", label: "安排好了，却没照着发生",
    reason: "两段经历都先有安排，随后出现了偏离安排的结果。",
    read: text => /计划|路线|闹钟/.test(text) && /写|认真|计划好|提前/.test(text) && /没照|没.*照|留在家|关掉|翻了个身|还是|多躺|取消/.test(text)
      ? { kind: /闹钟/.test(text) ? "闹钟" : "计划", action: "做过安排，结果却偏离了安排" } : null,
  },
  {
    id: "sound-lingers", theme: "unspoken", label: "声音停了，片段还在",
    reason: "原话都明确提到声音或耳机已经停止，片段却仍在脑子里继续。",
    read: text => /耳机|音乐|歌|副歌/.test(text) && /摘|断开|暂停|停/.test(text) && /脑子|还在|循环/.test(text)
      ? { kind: "声音", action: "声音已经停止，片段却仍在继续" } : null,
  },
  {
    id: "return-to-origin", theme: "undone", label: "动过一下，又回到原处",
    reason: "两件事都记录了一次动作，随后撤回或回到了原来的状态。",
    read: text => /挪|修改|画.*圈|折/.test(text) && /撤销|换回|回到|展开/.test(text)
      ? { kind: /纸|折/.test(text) ? "折叠" : /光标/.test(text) ? "移动" : "修改", action: "做过动作，又回到了先前的状态" } : null,
  },
];

function evidenceFor(artifact: Artifact) {
  // Only submitted words are evidence; generated titles, tags and IDs cannot create links.
  return experiences.flatMap(experience => {
    const evidence = experience.read(artifact.desc);
    return evidence ? [{ experience, evidence }] : [];
  });
}
export function classifyResonance(artifact: Artifact): ResonanceThemeId | null {
  return evidenceFor(artifact)[0]?.experience.theme || null;
}
export type ExperienceLink = {
  from: string; to: string; theme: ResonanceThemeId; experienceId: string;
  label: string; reason: string; fromEvidence: string; toEvidence: string; score: number;
};
export function createExperienceLinks(artifacts: Artifact[]): ExperienceLink[] {
  const profiles = artifacts.map(evidenceFor);
  const result: ExperienceLink[] = [];
  for (let i = 0; i < artifacts.length; i++) for (let j = i + 1; j < artifacts.length; j++) {
    if (!artifacts[i].isPublic || !artifacts[j].isPublic) continue;
    const matches = profiles[i].flatMap(a => {
      const b = profiles[j].find(item => item.experience.id === a.experience.id);
      if (!b) return [];
      return [{ from: artifacts[i].id, to: artifacts[j].id, theme: a.experience.theme,
        experienceId: a.experience.id, label: a.experience.label, reason: a.experience.reason,
        fromEvidence: a.evidence.action, toEvidence: b.evidence.action,
        score: 10 + (a.evidence.kind !== b.evidence.kind ? 3 : 0) +
          (!artifacts[i].id.startsWith("MOM-GRAPH-SAMPLE-") && !artifacts[j].id.startsWith("MOM-GRAPH-SAMPLE-") ? 1 : 0),
      }];
    });
    matches.sort((a, b) => b.score - a.score);
    if (matches[0]) result.push(matches[0]);
  }
  return result.sort((a, b) => b.score - a.score || `${a.from}|${a.to}`.localeCompare(`${b.from}|${b.to}`));
}
export function strongestConnections(links: ExperienceLink[], id: string, limit = 3) {
  return links.filter(link => link.from === id || link.to === id).slice(0, limit);
}
export function sparseExperienceLinks(links: ExperienceLink[], limit = 3) {
  const degree = new Map<string, number>();
  return links.filter(link => {
    if ((degree.get(link.from) || 0) >= limit || (degree.get(link.to) || 0) >= limit) return false;
    degree.set(link.from, (degree.get(link.from) || 0) + 1);
    degree.set(link.to, (degree.get(link.to) || 0) + 1);
    return true;
  });
}
