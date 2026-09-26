"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { findHistoricConnections, historicMoments, type HistoricMoment } from "@/lib/ancient-resonance";

type Props = { handoff?: { thought: string; title: string; key: number; isPublic?: boolean; allowModel: boolean } | null; onReturnToDraft?: () => void };
type OpenMatch = { person: string; context: string; moment: string; resonance: string; sourceName: string; sourceUrl: string; material: string };
type MatchResponse = { source?: "offline" | "ai"; matches?: { id: string; resonance: string }[]; openMatches?: OpenMatch[]; searchCount?: number; searchProvider?: string; modelAvailable?: boolean };

function MomentCarousel({ moments, offset, label, intervalMs, paused, onSelect }: { moments: HistoricMoment[]; offset: number; label: string; intervalMs: number; paused: boolean; onSelect: (moment: HistoricMoment) => void }) {
  const [index, setIndex] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const lastManualChange = useRef(0);

  useEffect(() => {
    if (paused || isInteracting || moments.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches || Date.now() - lastManualChange.current < intervalMs) return;
      setIndex((current) => (current + 1) % moments.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, isInteracting, moments.length, paused]);

  const move = (direction: number) => {
    lastManualChange.current = Date.now();
    setIndex((current) => (current + direction + moments.length) % moments.length);
  };
  const moment = moments[index];
  if (!moment) return null;

  return (
    <div
      className="ancient-carousel"
      role="region"
      aria-roledescription="轮播"
      aria-label={label}
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocusCapture={() => setIsInteracting(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsInteracting(false); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(event.key === "ArrowRight" ? 1 : -1);
        }
      }}
    >
      <button type="button" className="ancient-carousel-feature" onClick={() => onSelect(moment)} aria-label={`查看${moment.person}：${moment.object}`}>
        <span className="ancient-carousel-photo" key={moment.id}>
          <Image src={moment.imagePath} alt={`${moment.person}：${moment.doing}的情景再现`} fill sizes="(max-width: 1000px) 100vw, 50vw" />
          <span className="ancient-case-index">MOMENT / {String(offset + index + 1).padStart(2, "0")}</span>
          <span className="ancient-image-person">{moment.person}</span>
          <span className="ancient-image-label">AI 情景再现</span>
        </span>
        <span className="ancient-carousel-caption"><strong>{moment.object}</strong><span>{moment.doing}</span><em>查看这件小事 ↗</em></span>
      </button>
      <div className="ancient-carousel-controls">
        <span className="ancient-carousel-count"><b>{String(index + 1).padStart(2, "0")}</b> / {String(moments.length).padStart(2, "0")}</span>
        <span className="ancient-carousel-track" aria-hidden="true"><span style={{ width: `${((index + 1) / moments.length) * 100}%` }} /></span>
        <span className="ancient-carousel-arrows"><button type="button" onClick={() => move(-1)} aria-label={`${label}：上一件`}>←</button><button type="button" onClick={() => move(1)} aria-label={`${label}：下一件`}>→</button></span>
      </div>
    </div>
  );
}

export default function AncientResonance({ handoff, onReturnToDraft }: Props) {
  const [selected, setSelected] = useState<HistoricMoment | null>(null);
  const [openMatches, setOpenMatches] = useState<OpenMatch[]>([]);
  const [searchCount, setSearchCount] = useState(0);
  const [suggestedMoments, setSuggestedMoments] = useState<{ moment: HistoricMoment; resonance: string }[]>([]);
  const [matchStatus, setMatchStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [onlineHandoffKey, setOnlineHandoffKey] = useState<number | null>(null);
  const shouldUseModel = Boolean(handoff?.allowModel || (handoff && onlineHandoffKey === handoff.key));
  const handoffMatches = handoff ? findHistoricConnections(`${handoff.title} ${handoff.thought}`) : [];
  useEffect(() => {
    let active = true;
    setOpenMatches([]);
    setSearchCount(0);
    setSuggestedMoments([]);
    if (!handoff || !shouldUseModel) { setMatchStatus("idle"); return () => { active = false; }; }
    setMatchStatus("loading");
    fetch("/api/ancient-resonance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thought: `${handoff.title} ${handoff.thought}`.trim(), allowModel: true }),
    }).then(async (response) => {
      if (!response.ok) throw new Error("matching unavailable");
      return response.json() as Promise<MatchResponse>;
    }).then((result) => {
      if (!active) return;
      setOpenMatches(Array.isArray(result.openMatches) ? result.openMatches : []);
      setSearchCount(typeof result.searchCount === "number" ? result.searchCount : 0);
      setSuggestedMoments((Array.isArray(result.matches) ? result.matches : []).flatMap(({ id, resonance }) => {
        const moment = historicMoments.find((item) => item.id === id);
        return moment ? [{ moment, resonance }] : [];
      }));
      setMatchStatus(result.source === "ai" ? "ready" : "unavailable");
    }).catch(() => { if (active) setMatchStatus("unavailable"); });
    return () => { active = false; };
  }, [handoff?.key, handoff?.allowModel, handoff?.thought, handoff?.title, shouldUseModel]);
  const unoccupiedMoments = historicMoments.filter((moment) => moment.section === "leisure");
  const discoveryMoments = historicMoments.filter((moment) => moment.section === "discovery");
  const combinedHandoffMatches = [...handoffMatches, ...suggestedMoments.filter(({ moment }) => !handoffMatches.some((item) => item.moment.id === moment.id))];
  return (
    <section className="ancient-scene" aria-label="与先贤共振">
      {handoff && <div className="ancient-handoff" aria-label="与你的小事相关的先贤故事">
        <div className="ancient-handoff-head"><div><p className="form-kicker">FROM YOUR MOMENT / 来自你刚写下的小事</p><h2>你的这一刻，与这些先贤有一点相像</h2><p className="ancient-handoff-quote">“{handoff.thought}”</p></div>{onReturnToDraft && <button type="button" className="return-to-draft" onClick={onReturnToDraft}>← 返回，继续入藏</button>}</div>
        {combinedHandoffMatches.length > 0 || openMatches.length > 0 ? <div className="ancient-handoff-results">{combinedHandoffMatches.map(({ moment, resonance }) => <button type="button" key={moment.id} onClick={() => setSelected(moment)}><span className="ancient-handoff-image"><Image src={moment.imagePath} alt="" fill sizes="(max-width: 760px) 100vw, 30vw" /><span className="ancient-image-person">{moment.person}</span></span><span>{moment.person} · {moment.object}</span><strong>{moment.title}</strong><small>{resonance}</small><b aria-hidden="true">↗</b></button>)}{openMatches.map((match, index) => <article className="ancient-open-match" key={`${match.person}-${index}`}><span className="ancient-open-kicker">LIVE WEB SEARCH / 实时网页检索</span><span className="ancient-open-person">{match.person}{match.context ? ` · ${match.context}` : ""}</span><strong>{match.moment}</strong><small>{match.resonance}</small><a href={match.sourceUrl} target="_blank" rel="noreferrer">{match.sourceName} ↗</a><em>{match.material} · 点击查看条目与参考文献</em></article>)}</div> : <p className="ancient-no-match">{matchStatus === "loading" ? "正在联网搜索中文和英文人物资料，再寻找与你这件小事的关联……" : matchStatus === "unavailable" ? "联网搜索暂不可用，已保留本地馆藏匹配；请检查网络或模型配置。" : matchStatus === "ready" && searchCount > 0 ? `已实时搜索 ${searchCount} 条资料，暂未找到足够贴切的关联。你的小事仍值得入藏。` : "暂时没有找到贴近的历史回声。你的小事仍值得入藏；也可以继续浏览下面的故事。"}</p>}
        {handoff && handoff.isPublic !== false && !shouldUseModel && <button type="button" className="resonance-search-now" onClick={() => setOnlineHandoffKey(handoff.key)}>联网搜索相关名人 ↗ <small>会把这段小事发送给七源 Hub</small></button>}
        {matchStatus === "loading" && <p className="ancient-match-progress" role="status">正在联网检索人物条目，并让模型根据检索到的资料进行关联……</p>}
        {matchStatus === "unavailable" && shouldUseModel && <p className="ancient-match-progress" role="status">联网扩展暂不可用，已保留本地馆藏匹配；请检查网络或模型配置。</p>}
        <p className="ancient-handoff-note">{shouldUseModel ? matchStatus === "ready" ? `已联网搜索中文和英文维基百科，共检索 ${searchCount} 条资料，再由模型依据原文建立关联。每条卡片都标明自己的来源和资料类型，可点击核对；这段小事已发送给七源 Hub。` : "会联网检索中文和英文资料，再把搜索结果与你的小事关联；这段文字会发送给七源 Hub。" : "按文字中的元素和想法作本机联想，未上传这段记录；历史事实以每件馆藏的来源为准。"}</p>
      </div>}
      <div className="ancient-intro">
        <p className="eyebrow"><span className="red-line" /> GREAT IDEAS, UNPLANNED <span className="red-line" /></p>
        <h1>历史上的无意义时刻</h1>
        <p className="ancient-lede">有些时刻没有产出，也值得被看见。</p>
        <p className="ancient-copy">时间不必总换来成果。有些片刻只是生活本身；有些偶然，后来才有了回响。</p>
        <div className="ancient-thesis"><span>消磨时间，也是生活的一部分</span><b>·</b><span>偶然留意，可能带来新的发现</span></div>
      </div>

      <div className="ancient-two-boards">
        <section className="ancient-collection-group ancient-board" aria-label="名人也有无所事事的时候">
          <div className="collection-group-title"><span>ORDINARY MOMENTS / 01—{String(unoccupiedMoments.length).padStart(2, "0")}</span><h2>名人也有无所事事的时候</h2><p>日记、诗词和典籍里，也留下了消遣、闲坐与慢下来的片刻。它们不必导向什么成就。</p></div>
          <MomentCarousel moments={unoccupiedMoments} offset={0} label="名人也有无所事事的时候" intervalMs={9000} paused={selected !== null} onSelect={setSelected} />
        </section>
        <section className="ancient-collection-group ancient-board" aria-label="偶然的发现与创造">
          <div className="collection-group-title"><span>UNEXPECTED DISCOVERIES / {String(unoccupiedMoments.length + 1).padStart(2, "0")}—{String(historicMoments.length).padStart(2, "0")}</span><h2>偶然的发现与创造</h2><p>有时，人们多看了一眼、多问了一句，意外由此打开新的方向。</p></div>
          <MomentCarousel moments={discoveryMoments} offset={unoccupiedMoments.length} label="偶然的发现与创造" intervalMs={10500} paused={selected !== null} onSelect={setSelected} />
        </section>
      </div>

      <div className="ancient-closing"><span>NOT EVERY WANDERING MUST BECOME A DISCOVERY.</span><p>你的这一刻，可以从一次新的联想开始。<br />它不必复制先贤们的后来。</p></div>

      {selected && <div className="modal-backdrop ancient-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><article className="historic-detail" role="dialog" aria-modal="true" aria-label={`${selected.person}的馆藏故事`}><div className="modal-top"><span>HISTORIC MOMENT / {selected.evidence}</span><button type="button" onClick={() => setSelected(null)} aria-label="关闭故事">×</button></div><div className="historic-image"><Image src={selected.imagePath} alt={`${selected.person}：${selected.doing}的情景再现`} fill sizes="(max-width: 760px) 92vw, 630px" /><span className="ancient-image-person">{selected.person}</span><span className="ancient-image-label">AI 情景再现 · 非历史照片</span></div><p className="form-kicker">{selected.person} · {selected.doing}</p><div className="historic-reveal"><span className="historic-object">{selected.object}</span><span className="historic-arrow">↓</span><span className="historic-pattern">{selected.pattern}</span></div><h2>{selected.title}</h2><p className="historic-later">{selected.later}</p><p className="evidence-note">史料边界：{selected.sourceContext ?? (selected.evidence === "唐人笔记" ? "本条依据唐人笔记《隋唐嘉话》讲述，作为轶事展出。" : selected.evidence === "诗中场景" ? "本条根据诗词和作品小序作情景呈现，不等同于完整传记记录。" : selected.evidence === "日记记载" ? "本条据日记档案呈现一天中的片段，不把片段延伸成整日生活。" : selected.person.startsWith("老子") ? "本条呈现《道德经》中的文本意境，不视作可考证的老子亲历。" : selected.evidence === "典籍文本" ? "本条依典籍原文叙述，按文本记录的边界理解。" : selected.section === "leisure" ? "本条呈现资料记下的生活片段，无须把它解释成某项成就的起点。" : "这里记录的是来源可支持的发现经过；回望式标题不表示偶然事件单独造成了后续成果。")}</p><a className="historic-source" href={selected.sourceUrl} target="_blank" rel="noreferrer">查看来源：{selected.sourceName} ↗</a></article></div>}
    </section>
  );
}
