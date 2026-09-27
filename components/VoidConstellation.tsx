"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import EncounterPrinter from "@/components/EncounterPrinter";
import type { Artifact } from "@/lib/artifact";
import { classifyResonance, resonanceThemes, createExperienceLinks, sparseExperienceLinks, strongestConnections } from "@/lib/resonance";
import { isExhibitionSample as isConstellationSample } from "@/lib/exhibition-catalog";
import { createGraphNodes, stepGraph, type GraphNode } from "@/lib/constellation-physics";

type Props = { artifacts: Artifact[]; onOpen: (artifact: Artifact) => void; arrivalId?: string | null; playbackReady?: boolean };
const colors = { unspoken: "#d99c85", undone: "#c9aa68", leftbehind: "#8db5aa", pause: "#9c9bc7" };
function shortTitle(artifact: Artifact) { return artifact.title.replace(/[《》]/g, ""); }
function serial(artifact: Artifact) { return artifact.id.match(/\d{4}$/)?.[0] || "LIVE"; }

export default function VoidConstellation({ artifacts, onOpen, arrivalId, playbackReady = true }: Props) {
  const publicArtifacts = useMemo(() => artifacts.filter(item => item.isPublic), [artifacts]);
  const graphArtifacts = publicArtifacts;
  const sampleCount = graphArtifacts.filter(item => isConstellationSample(item.id)).length;
  const graphItems = useMemo(() => graphArtifacts.map(item => ({ id: item.id, theme: classifyResonance(item) })), [graphArtifacts]);
  const allLinks = useMemo(() => createExperienceLinks(graphArtifacts), [graphArtifacts]);
  const openingLink = useMemo(() => {
    const sunlight = graphArtifacts.find(item => shortTitle(item) === "夕阳坐过的椅子");
    const shadow = graphArtifacts.find(item => shortTitle(item) === "树影挪了半步");
    const gentle = sunlight && shadow && allLinks.find(link =>
      (link.from === sunlight.id && link.to === shadow.id) || (link.to === sunlight.id && link.from === shadow.id));
    if (gentle) return { ...gentle, from: sunlight.id, to: shadow.id };
    const unsent = graphArtifacts.find(item => shortTitle(item) === "没有按下发送");
    const erased = graphArtifacts.find(item => shortTitle(item) === "输入框里的“算了”");
    const preferred = unsent && erased && allLinks.find(link =>
      (link.from === unsent.id && link.to === erased.id) || (link.to === unsent.id && link.from === erased.id));
    return preferred ? { ...preferred, from: unsent.id, to: erased.id } : allLinks[0];
  }, [graphArtifacts, allLinks]);
  const baseEdges = useMemo(() => sparseExperienceLinks(allLinks), [allLinks]);
  const graphKey = graphArtifacts.map(item => `${item.id}:${item.desc}`).join("|");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const hasArrival = Boolean(arrivalId && publicArtifacts.some(item => item.id === arrivalId));
  const arrivalLink = hasArrival ? strongestConnections(allLinks, arrivalId!, 1)[0] : undefined;
  const [phase, setPhase] = useState(3);
  const [playing, setPlaying] = useState(false);
  const storyRef = useRef({ playing: false });
  storyRef.current.playing = playing;
  const storyTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  function finishStory() {
    storyTimers.current.forEach(clearTimeout); storyTimers.current = [];
    storyRef.current.playing = false; setPlaying(false); setPhase(3);
    if (arrivalId && hasArrival) {
      try { sessionStorage.setItem(`mom-encounter-seen:${arrivalId}`, "1"); } catch { /* No persistent playback marker. */ }
    }
  }
  useEffect(() => {
    setPhase(3); setPlaying(false);
    if (!hasArrival || !arrivalId || !playbackReady) return;
    const key = `mom-encounter-seen:${arrivalId}`;
    try { if (sessionStorage.getItem(key)) return; } catch { /* Memory-only browsers still get the encounter. */ }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPhase(0); setPlaying(true);
    storyTimers.current = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1400),
      setTimeout(finishStory, 3000),
    ];
    return () => { storyTimers.current.forEach(clearTimeout); storyTimers.current = []; };
  }, [hasArrival, arrivalId, playbackReady]);
  const fieldRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const resetRef = useRef<() => void>(() => {});
  const paintRef = useRef<() => void>(() => {});
  // Automatic mode prefers this tab's latest public submission, then the curated opening.
  // An empty string explicitly returns to the full graph.
  const effectiveId = selectedId === null ? hasArrival ? arrivalId : openingLink?.from : selectedId;
  const automaticPartner = hasArrival ? arrivalLink && (arrivalLink.from === arrivalId ? arrivalLink.to : arrivalLink.from) : openingLink?.to;
  const effectivePartnerId = partnerId || (selectedId === null ? automaticPartner : null);
  const selected = graphArtifacts.find(item => item.id === effectiveId);
  const selectedTheme = selected ? classifyResonance(selected) : null;
  const themeInfo = resonanceThemes.find(theme => theme.id === selectedTheme);
  const requestedLink = selected && effectivePartnerId ? allLinks.find(link =>
    (link.from === selected.id && link.to === effectivePartnerId) || (link.to === selected.id && link.from === effectivePartnerId)) : undefined;
  const strongest = selected ? strongestConnections(allLinks, selected.id) : [];
  const relatedLinks = requestedLink ? selectedId === null ? [requestedLink] : [requestedLink, ...strongest.filter(link => link !== requestedLink)].slice(0, 3) : strongest;
  // Keep every connection, but print each shared relationship only once.
  const relatedLabels = relatedLinks.filter((link, index, links) =>
    links.findIndex(item => item.label.trim() === link.label.trim()) === index);
  const encounterLink = requestedLink || relatedLinks[0];
  const otherId = (link: (typeof allLinks)[number]) => link.from === selected?.id ? link.to : link.from;
  const partner = encounterLink ? graphArtifacts.find(item => item.id === otherId(encounterLink)) : undefined;
  const twoRetreats = selected && partner && [shortTitle(selected), shortTitle(partner)].includes("没有按下发送") && [shortTitle(selected), shortTitle(partner)].includes("输入框里的“算了”") && encounterLink?.experienceId === "prepared-unreleased";
  const encounterTitle = twoRetreats ? "两次微小的撤退" : encounterLink?.label;
  const neighborIds = relatedLinks.map(otherId);
  const focusedIds = new Set([...(selected ? [selected.id, ...neighborIds] : []), ...(hasArrival ? [arrivalId!] : [])]);
  const edgeKey = (from: string, to: string) => [from, to].sort().join("|");
  const focusKeys = new Set(relatedLinks.map(link => edgeKey(link.from, link.to)));
  const edges = [...baseEdges.filter(link => !focusKeys.has(edgeKey(link.from, link.to))), ...relatedLinks];
  const simulationRef = useRef({ edges, encounter: selected ? { root: selected.id, neighbors: neighborIds } : null });
  simulationRef.current = { edges, encounter: selected ? { root: selected.id, neighbors: neighborIds } : null };
  function select(id: string, counterpart: string | null = null) { finishStory(); setSelectedId(id); setPartnerId(counterpart); }

  useEffect(() => { paintRef.current(); }, [effectiveId, effectivePartnerId, playing]);

  useEffect(() => {
    if (!arrivalId) return;
    setSelectedId(null); setPartnerId(null);
  }, [arrivalId]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    let width = field.clientWidth, height = field.clientHeight;
    const prior = new Map(nodesRef.current.map(node => [node.id, node]));
    let nodes = createGraphNodes(graphItems, width, height).map(node => prior.has(node.id) ? { ...prior.get(node.id)!, theme: node.theme } : node);
    nodesRef.current = nodes;
    const byId = new Map(nodes.map(node => [node.id, node]));
    const elements = new Map(Array.from(field.querySelectorAll<HTMLElement>("[data-node-id]")).map(element => [element.dataset.nodeId!, element]));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, last = 0, clock = 0, suppressClickUntil = 0;
    let drag: { pointer: number; startX: number; startY: number; points: { node: GraphNode; x: number; y: number }[]; moved: boolean } | null = null;
    const paint = () => {
      field.querySelectorAll("svg").forEach(svg => svg.setAttribute("viewBox", `0 0 ${width} ${height}`));
      for (const node of nodes) {
        const element = elements.get(node.id);
        if (element) { element.style.left = "0"; element.style.top = "0"; element.style.transform = `translate3d(${node.x}px, ${node.y}px, 0) translate(-50%, -12px)`; }
      }
      for (const line of field.querySelectorAll<SVGLineElement>("line[data-from]")) {
        const from = byId.get(line.dataset.from!), to = byId.get(line.dataset.to!);
        if (!from || !to) continue;
        line.setAttribute("x1", String(from.x)); line.setAttribute("y1", String(from.y));
        line.setAttribute("x2", String(to.x)); line.setAttribute("y2", String(to.y));
      }
      for (const curve of field.querySelectorAll<SVGPathElement>("path[data-curve-from]")) {
        const from = byId.get(curve.dataset.curveFrom!), to = byId.get(curve.dataset.curveTo!);
        if (!from || !to) continue;
        const dx = to.x - from.x, dy = to.y - from.y, distance = Math.max(1, Math.hypot(dx, dy));
        const bend = Math.min(65, distance * .22);
        const cx = (from.x + to.x) / 2 - dy / distance * bend;
        const cy = (from.y + to.y) / 2 + dx / distance * bend;
        curve.setAttribute("d", `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`);
      }
      const labelPositions: { x: number; y: number }[] = [];
      for (const label of field.querySelectorAll<SVGGElement>("[data-label-from]")) {
        const from = byId.get(label.dataset.labelFrom!), to = byId.get(label.dataset.labelTo!);
        if (!from || !to) continue;
        const x = Math.max(105, Math.min(width - 105, (from.x + to.x) / 2));
        let y = Math.max(32, Math.min(height - 70, (from.y + to.y) / 2 - 19));
        for (let attempt = 0; attempt < 4; attempt++) {
          const collision = labelPositions.find(position => Math.abs(position.x - x) < 210 && Math.abs(position.y - y) < 32);
          if (!collision) break;
          y = collision.y + 34 <= height - 70 ? collision.y + 34 : collision.y - 34;
        }
        labelPositions.push({ x, y });
        label.setAttribute("transform", `translate(${x},${y})`);
      }
    };
    paintRef.current = paint;
    const reset = () => {
      const fresh = createGraphNodes(graphItems, width, height);
      fresh.forEach(node => Object.assign(byId.get(node.id)!, node));
      paint();
    };
    resetRef.current = reset;
    const resize = new ResizeObserver(() => {
      const nextWidth = field.clientWidth, nextHeight = field.clientHeight;
      if (!nextWidth || !nextHeight) return;
      nodes.forEach(node => { node.x *= nextWidth / Math.max(width, 1); node.y *= nextHeight / Math.max(height, 1); });
      width = nextWidth; height = nextHeight; paint();
    });
    resize.observe(field);
    const targets = (element: Element): GraphNode[] => {
      const node = element.closest<HTMLElement>("[data-node-id]");
      if (node) return [byId.get(node.dataset.nodeId!)!].filter(Boolean);
      const edge = element.closest<SVGLineElement>("[data-edge-key]");
      return edge ? [byId.get(edge.dataset.from!)!, byId.get(edge.dataset.to!)!].filter(Boolean) : [];
    };
    const pointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      const points = targets(event.target as Element).map(node => ({ node, x: node.x, y: node.y }));
      if (!points.length) return;
      finishStory();
      drag = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, points, moved: false };
      points.forEach(({ node }) => { node.vx = 0; node.vy = 0; });
    };
    const pointerMove = (event: PointerEvent) => {
      if (!drag || drag.pointer !== event.pointerId) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
        drag.moved = true; field.setPointerCapture(event.pointerId);
        field.classList.add("is-dragging");
        drag.points.forEach(({ node }) => elements.get(node.id)?.classList.add("is-node-dragging"));
        setHoveredId(null);
      }
      if (!drag.moved) return;
      event.preventDefault();
      // Move an edge's two ends together, while keeping both inside the plane.
      const dx = Math.max(Math.max(...drag.points.map(point => 28 - point.x)), Math.min(Math.min(...drag.points.map(point => width - 28 - point.x)), event.clientX - drag.startX));
      const dy = Math.max(Math.max(...drag.points.map(point => 46 - point.y)), Math.min(Math.min(...drag.points.map(point => height - 110 - point.y)), event.clientY - drag.startY));
      drag.points.forEach(({ node, x, y }) => { node.x = x + dx; node.y = y + dy; node.vx = 0; node.vy = 0; });
      paint();
    };
    const pointerEnd = (event: PointerEvent) => {
      if (!drag || drag.pointer !== event.pointerId) return;
      if (drag.moved) suppressClickUntil = performance.now() + 200;
      drag.points.forEach(({ node }) => elements.get(node.id)?.classList.remove("is-node-dragging"));
      drag = null; field.classList.remove("is-dragging");
      if (field.hasPointerCapture(event.pointerId)) field.releasePointerCapture(event.pointerId);
    };
    const pointerLeave = () => { if (drag && !drag.moved) drag = null; };
    const click = (event: MouseEvent) => { if (event.detail && performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); } };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Home") { event.preventDefault(); finishStory(); reset(); return; }
      const direction = { ArrowLeft: [-14, 0], ArrowRight: [14, 0], ArrowUp: [0, -14], ArrowDown: [0, 14] }[event.key];
      if (!direction) return;
      const moving = targets(event.target as Element);
      if (!moving.length) return;
      event.preventDefault();
      finishStory();
      moving.forEach(node => { node.x = Math.max(28, Math.min(width - 28, node.x + direction[0])); node.y = Math.max(46, Math.min(height - 110, node.y + direction[1])); node.vx = 0; node.vy = 0; });
      paint();
    };
    field.addEventListener("pointerdown", pointerDown); field.addEventListener("pointermove", pointerMove);
    field.addEventListener("pointerup", pointerEnd); field.addEventListener("pointercancel", pointerEnd);
    field.addEventListener("lostpointercapture", pointerEnd); field.addEventListener("pointerleave", pointerLeave);
    field.addEventListener("click", click, true); field.addEventListener("keydown", keyboard);
    paint();
    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      if (now - last < 32) return;
      const delta = last ? Math.min((now - last) / 1000, .06) : 0;
      last = now;
      if (document.hidden || reduced.matches || storyRef.current.playing) return;
      clock += delta;
      const held = new Set(drag?.points.map(point => point.node.id) || []);
      stepGraph(nodes, simulationRef.current.edges, width, height, clock, delta, held, simulationRef.current.encounter); paint();
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); field.classList.remove("is-dragging");
      elements.forEach(element => element.classList.remove("is-node-dragging"));
      const pointer = drag?.pointer; drag = null;
      if (pointer !== undefined && field.hasPointerCapture(pointer)) field.releasePointerCapture(pointer);
      field.removeEventListener("pointerdown", pointerDown); field.removeEventListener("pointermove", pointerMove);
      field.removeEventListener("pointerup", pointerEnd); field.removeEventListener("pointercancel", pointerEnd);
      field.removeEventListener("lostpointercapture", pointerEnd); field.removeEventListener("pointerleave", pointerLeave);
      field.removeEventListener("click", click, true); field.removeEventListener("keydown", keyboard);
    };
  }, [graphKey]);

  return (
    <section className="constellation-scene resonance-scene" aria-label="小事星图">
      <div className="resonance-intro">
        <div><p className="resonance-eyebrow"><span /> MODE 02 / ENCOUNTERS</p><h1>这些小事，<em>偶尔会碰见彼此。</em></h1><p className="resonance-lead">{hasArrival ? "你刚留下的小事正持续闪烁。看看它遇见了什么，或拖动微光挪动这次相遇。" : "点亮一件，看看另一段经历为什么与它相似。拖动微光，也可以挪动这次相遇。"}</p></div>
        <div className="resonance-count"><strong>{String(graphArtifacts.length).padStart(2, "0")}</strong><span>个游移节点<br />{publicArtifacts.length - sampleCount} 件在展投稿 · {sampleCount} 件展陈样本</span></div>
      </div>
      <div className="resonance-layout">
        <div ref={fieldRef} className={`resonance-field living-graph ${selected ? "has-encounter" : ""} ${playing ? "is-playing-encounter" : ""}`} data-story-phase={phase} role="region" aria-label="共鸣图谱：点击节点呈现相遇；拖动单个节点或连线局部移动；方向键移动，Home 重排">
          <svg className="graph-edges" role="group" aria-label="相似经历的共鸣连线，可单独拖动" viewBox="0 0 1000 700" preserveAspectRatio="none">
            {edges.map(edge => <g key={`${edge.from}|${edge.to}`}>
              <line data-from={edge.from} data-to={edge.to} className={`graph-edge ${focusKeys.has(edgeKey(edge.from, edge.to)) ? "is-lit" : ""} ${edge === encounterLink ? "is-encounter-primary" : ""}`} style={{ "--echo-color": colors[edge.theme] } as CSSProperties} />
              <line data-from={edge.from} data-to={edge.to} data-edge-key={`${edge.from}|${edge.to}`} className="graph-edge-hit" role="button" tabIndex={0} aria-label={`查看或拖动联系：${shortTitle(graphArtifacts.find(item => item.id === edge.from)!)}与${shortTitle(graphArtifacts.find(item => item.id === edge.to)!)}，${edge.label}`} onClick={() => select(edge.from, edge.to)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(edge.from, edge.to); } }} />
            </g>)}
            {encounterLink && <g>
              {playing && selected && partner && <path key={`${selected.id}:${partner.id}`} className="encounter-traveler" pathLength="100" data-curve-from={selected.id} data-curve-to={partner.id} />}
              <path className="encounter-arc" data-curve-from={encounterLink.from} data-curve-to={encounterLink.to} />
              <path className="graph-edge-hit encounter-arc-hit" data-curve-from={encounterLink.from} data-curve-to={encounterLink.to} data-from={encounterLink.from} data-to={encounterLink.to} data-edge-key={`${encounterLink.from}|${encounterLink.to}`} role="button" tabIndex={0} aria-label={`金色相遇连线：${encounterTitle}，可拖动`} onClick={() => select(encounterLink.from, encounterLink.to)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(encounterLink.from, encounterLink.to); } }} />
            </g>}
          </svg>
          {graphArtifacts.map((artifact, index) => {
            const theme = graphItems[index].theme;
            return <button type="button" key={artifact.id} data-node-id={artifact.id}
              className={`resonance-node graph-node ${isConstellationSample(artifact.id) ? "is-sample" : ""} ${selected?.id === artifact.id ? "is-active" : ""} ${neighborIds.includes(artifact.id) ? "is-related" : ""} ${selected && !focusedIds.has(artifact.id) ? "is-muted" : ""} ${hoveredId === artifact.id ? "is-hovered" : ""} ${!theme ? "is-unmatched" : ""} ${hasArrival && artifact.id === arrivalId ? "is-my-star" : ""}`}
              style={{ left: `${20 + index % 8 * 8}%`, top: `${25 + Math.floor(index / 8) * 12}%`, "--echo-color": hasArrival && artifact.id === arrivalId ? "#ffb385" : selected?.id === artifact.id || partner?.id === artifact.id ? "#e9bd66" : theme ? colors[theme] : "#8a858c" } as CSSProperties}
              onMouseEnter={() => setHoveredId(artifact.id)} onMouseLeave={() => setHoveredId(null)} onFocus={() => setHoveredId(artifact.id)} onBlur={() => setHoveredId(null)}
              onClick={() => select(artifact.id)} aria-label={`查看共鸣藏品 ${artifact.title}${isConstellationSample(artifact.id) ? "，图谱样本" : ""}`} aria-pressed={selected?.id === artifact.id}>
              <span className="node-light" aria-hidden="true">{artifact.imageUrl && <img src={artifact.imageUrl} alt="" draggable={false} />}</span>
              <span className="node-label"><strong>{shortTitle(artifact)}</strong><small>{hasArrival && artifact.id === arrivalId ? `你的小事 · № ${serial(artifact)}` : isConstellationSample(artifact.id) ? "情景样本" : `№ ${serial(artifact)}`}</small></span>
            </button>;
          })}
          <svg className="encounter-labels" aria-hidden="true" viewBox="0 0 1000 700" preserveAspectRatio="none">
            {relatedLabels.map((link, index) => <g key={`${selected?.id}:${edgeKey(link.from, link.to)}`} data-label-from={link.from} data-label-to={link.to} style={{ "--encounter-delay": `${index * 180}ms` } as CSSProperties}>
              <g className="encounter-label"><rect x="-102" y="-13" width="204" height="26" rx="3" /><text textAnchor="middle" dominantBaseline="central">{link.label}</text></g>
            </g>)}
          </svg>
          <div className="encounter-navigation">
            {selected && <button type="button" className="encounter-clear" onClick={() => select("")}>回到漂流全景 ×</button>}
            {hasArrival && <button type="button" className="encounter-my-star" onClick={() => { finishStory(); setSelectedId(null); setPartnerId(null); }}>◎ 找到我的星</button>}
          </div>
          <button type="button" className="resonance-reset" onClick={() => { finishStory(); resetRef.current(); }}>重排图谱 ↺</button>
          <div className="graph-legend">{resonanceThemes.map(theme => <span key={theme.id} style={{ "--echo-color": colors[theme.id] } as CSSProperties}><i />{theme.name}</span>)}<span><i style={{ background: "#8a858c" }} />独自漂流</span></div>
          <div className="resonance-field-note">拖节点 / 连线：局部移动 · 点击微光：呈现相遇</div>
        </div>
        <aside className="resonance-inspector" aria-live="polite">
          {selected && <>
            <div className="inspector-top"><span>ENCOUNTER #{themeInfo?.number || "00"}</span><span className="inspector-signal">{hasArrival && selected.id === arrivalId ? "● YOUR MOMENT" : selectedId === null && partner ? "● OPENING SCENE" : partner ? "● TWO MOMENTS" : "● DRIFTING"}</span></div>
            <EncounterPrinter key={`${selected.id}:${partner?.id || "alone"}`} selected={selected} partner={partner} link={encounterLink} mine={hasArrival && selected.id === arrivalId} phase={phase} playing={playing} onSkip={finishStory} onOpen={onOpen} />
          </>}
          {!selected && <div className="encounter-welcome"><p>ENCOUNTER / 等待一次相遇</p><h2>点亮一件小事。</h2><span>看看它与另一段经历<br />为什么会连在一起。</span><small>每条线都来自原话里的动作与结果。<br />没有确切线索的小事，也可以独自漂流。</small></div>}
        </aside>
      </div>
      <p className="resonance-footnote">事情之间的联系，来自原话中可见的经历线索。展陈样本单独标识；私密藏品不会进入这里。</p>
    </section>
  );
}
