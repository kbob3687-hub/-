import { ArtifactDraft, ArtifactTag } from "@/lib/artifact";

export type AppraisalInput = {
  desc: string;
  title?: string;
  imageUrl?: string;
  isPublic: boolean;
};

const groups: { tag: ArtifactTag; words: string[]; fallbackTitle: string }[] = [
  { tag: "液体耗散", words: ["辣油", "外卖盒", "咖啡", "奶茶", "雨", "水", "茶", "杯", "冰"], fallbackTitle: "《留在杯底的片刻》" },
  { tag: "声学废料", words: ["耳机", "副歌", "音乐", "声音", "响", "唱", "歌", "听"], fallbackTitle: "《声音停下以后》" },
  { tag: "未发字符", words: ["输入框", "消息", "草稿", "发送", "句号", "打字", "没发", "删掉"], fallbackTitle: "《留在输入框里的话》" },
  { tag: "生理宕机", words: ["发呆", "走神", "闹钟", "睡", "愣", "坐着", "休息"], fallbackTitle: "《一段没有安排的时间》" },
  { tag: "光学残片", words: ["Figma", "figma", "画布", "截图", "相册", "书页", "照片", "颜色", "影子", "灯光"], fallbackTitle: "《留在眼前的画面》" },
  { tag: "物理停摆", words: ["电梯", "红灯", "排队", "按钮", "等车", "车站", "堵车"], fallbackTitle: "《等待没有缩短》" },
];

const motifs: { pattern: RegExp; title: string; conclusion: string }[] = [
  { pattern: /(消息|输入框|草稿).*(删|没发|未发)|(删|没发|未发).*(消息|输入框|草稿)/, title: "《留在输入框里的话》", conclusion: "字被删掉以后，它曾被写下这件事还在。准予封存。" },
  { pattern: /闹钟.*(躺|不起|推迟|晚)|(躺|不起|推迟|晚).*闹钟/, title: "《闹钟之后的几分钟》", conclusion: "闹钟响过，早晨仍按自己的速度开始。准予封存。" },
  { pattern: /(截图|相册|收藏).*(没看|没打开|再没)|(没看|没打开|再没).*(截图|相册|收藏)/, title: "《再没打开的那一张》", conclusion: "保存的动作发生过，后来没有再打开。准予封存。" },
  { pattern: /电梯/, title: "《电梯抵达之前》", conclusion: "等待的这几秒，也有了自己的编号。准予封存。" },
  { pattern: /发呆|走神/, title: "《一段没交给任何人的时间》", conclusion: "这段走神没有任务，仍真实地经过。准予封存。" },
];

export function isProductiveSubmission(input: string) {
  // Local-only theme hint for private records. Public decisions use server review.
  if (/(发呆|走神|没发|未发|删掉|废弃|白等|没用上|没再|未再|算了)/.test(input)) return false;
  return /(完成|达成|学会|赚了|实现).{0,20}(目标|任务|业绩|报告|项目|单词|题目)|教程|操作步骤|购买链接|优惠促销/.test(input);
}

export function offlineAppraisal(input: AppraisalInput): ArtifactDraft {
  const desc = input.desc.trim();
  const priority = /(发呆|走神|愣住|睡着|休息)/.test(desc)
    ? groups.find((group) => group.tag === "生理宕机")
    : undefined;
  const found = priority ?? [...groups].sort((a, b) =>
    Math.max(0, ...b.words.filter((word) => desc.includes(word)).map((word) => word.length)) -
    Math.max(0, ...a.words.filter((word) => desc.includes(word)).map((word) => word.length))
  ).find(({ words }) => words.some((word) => desc.includes(word))) ?? groups[5];
  const motif = motifs.find(({ pattern }) => pattern.test(desc));
  const clauses = desc.split(/[，。！？；\n]/).map((part) => part.trim()).filter(Boolean);
  const first = clauses[0]?.slice(0, 38) || desc.slice(0, 38);
  const second = clauses[1]?.slice(0, 38);
  const focus = [...found.words].sort((a, b) => b.length - a.length).find((word) => desc.includes(word));
  const originalTitle = input.title?.trim().replace(/[《》]/g, "");
  const title = originalTitle ? `《${originalTitle}》` : motif?.title ?? (clauses[0]?.length > 3 && clauses[0].length <= 14 ? `《${clauses[0]}》` : found.fallbackTitle);

  return {
    title,
    tag: found.tag,
    desc,
    cot: [
      `原始记录里写着：「${first}」`,
      second ? `接着发生的是：「${second}」` : focus ? `记录里留下了「${focus}」这个细节` : "这段记录没有被添上新的情节",
      "编目只保存已经发生的事，不替它解释心情。",
    ],
    appraisalConclusion: motif?.conclusion ?? "这件小事真实地经过，也值得有一个编号。准予封存。",
    metrics: { gdpContribution: "0.0000%", entropyIncrease: "未计量" },
    imageUrl: input.imageUrl,
    isPublic: input.isPublic,
  };
}
