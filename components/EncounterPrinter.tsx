"use client";

import { useState } from "react";
import type { Artifact } from "@/lib/artifact";
import type { ExperienceLink } from "@/lib/resonance";
import { isExhibitionSample } from "@/lib/exhibition-catalog";

const captions: Record<string, string> = {
  "prepared-unreleased": "都认真准备过，却没有交出去。",
  "saved-unopened": "都留下了入口，却没有再进去。",
  "residue-after": "事情结束了，剩下的东西还在。",
  "process-pause": "过程还在继续，注意力停了一会儿。",
  "plan-diverged": "都安排好了，后来却没照着发生。",
  "sound-lingers": "声音已经停下，片段还在继续。",
  "return-to-origin": "都动过一下，又回到了原处。",
};
const clues: Record<string, RegExp> = {
  "prepared-unreleased": /(写完|写了|删掉|删除|没发|废弃|作废|撤销|换回)/g,
  "saved-unopened": /(截图|收藏|保存|没看过|再没看|没打开|再没打开|忘了)/g,
  "residue-after": /(剩了|剩|没喝完|凝住|凝固|冷了)/g,
  "process-pause": /(看着|盯着|发呆|走神|忘了|等待)/g,
  "plan-diverged": /(计划|安排|提前|关掉|多躺|没照着)/g,
  "sound-lingers": /(摘了|断开|暂停|脑子|还在|循环)/g,
  "return-to-origin": /(撤销|换回|回到|展开|折)/g,
};
function excerpt(text: string, experience?: string) {
  const chars = Array.from(text);
  const match = experience && clues[experience] ? text.match(clues[experience])?.[0] : null;
  const at = match ? Array.from(text.slice(0, text.indexOf(match))).length : 0;
  const start = Math.max(0, at - 12);
  return `${start ? "…" : ""}${chars.slice(start, start + 44).join("")}${chars.length > start + 44 ? "…" : ""}`;
}
function EvidenceQuote({ text, experience }: { text: string; experience?: string }) {
  const pattern = experience && clues[experience];
  return <blockquote>“{pattern ? text.split(pattern).map((part, index) => index % 2 ? <mark key={index}>{part}</mark> : part) : text}”</blockquote>;
}

export default function EncounterPrinter({ selected, partner, link, mine, phase, playing, onSkip, onOpen }: {
  selected: Artifact; partner?: Artifact; link?: ExperienceLink; mine: boolean;
  phase: number; playing: boolean; onSkip: () => void; onOpen: (item: Artifact) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const done = !playing || phase >= 3;
  return <div className={`encounter-printer ${playing ? "is-printing" : ""}`} data-print-phase={phase}>
    <div className="printer-toolbar"><span>{playing ? "正在打印这次相遇…" : partner ? "共鸣已出纸 / TWO MOMENTS" : mine ? "你的星，也有自己的位置" : "一件独自漂流的小事"}</span>{playing && <div><button type="button" onClick={onSkip}>跳过 →</button></div>}</div>
    <div className="printer-slot" aria-hidden="true" />
    <div className="printer-paper-feed" key={`${selected.id}:${partner?.id || "solo"}`}>
    <div className="encounter-paper" aria-busy={playing}>
      <section className="print-row print-root">
        <p>{mine ? "01 / 你留下的小事，已在这里" : "01 / 这件小事"}<small>{isExhibitionSample(selected.id) ? "展陈样本" : "公开投稿"}</small></p>
        <h3>{selected.title}</h3><EvidenceQuote text={excerpt(selected.desc, link?.experienceId)} experience={link?.experienceId} />
      </section>
      {partner && phase >= 1 && <section className="print-row print-partner"><p>02 / 它碰见了<small>{isExhibitionSample(partner.id) ? "展陈样本" : "公开投稿"}</small></p><h3>{partner.title}</h3><EvidenceQuote text={excerpt(partner.desc, link?.experienceId)} experience={link?.experienceId} /></section>}
      {phase >= 2 && <section className="print-row print-reason"><p>{partner ? "相遇的理由" : "独自漂流 / 也是一种存在"}</p><h2>{partner && link ? captions[link.experienceId] || link.label : "暂未遇见相似的小事。"}</h2>{!partner && <span>{mine ? "你的星" : "这件小事"}，也有自己的位置。</span>}</section>}
      <div className="paper-tear" aria-hidden="true" />
    </div>
    </div>
    {done && <details className="encounter-full" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary>展开这次相遇 ↗</summary>
      <div>{[selected, ...(partner ? [partner] : [])].map(item => <article key={item.id}><p>{item.title} · {isExhibitionSample(item.id) ? "展陈样本" : "公开投稿"}</p>{item.imageUrl && <img src={item.imageUrl} alt="藏品附图" />}<EvidenceQuote text={item.desc} experience={link?.experienceId} />{link && <small>{link.from === item.id ? link.fromEvidence : link.toEvidence}</small>}<button type="button" onClick={() => onOpen(item)}>查看完整档案 ↗</button></article>)}{link && <p>{link.reason}</p>}<small>联系来自原话中的动作与结果，不推断作者身份。展陈样本不代表用户投稿。</small></div>
    </details>}
  </div>;
}
