"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import CardItem, { type MuseumCard } from "@/components/CardItem";
import { floatPose, interpolatePose, tunnelPose, TUNNEL_NEAR, TUNNEL_SPACING, type GalleryPose } from "@/lib/gallery-space";
import styles from "./MuseumGallery.module.css";

export type GalleryMode = "float" | "tunnel3D";
type Props = {
  cards: MuseumCard[];
  floatIds?: readonly string[];
  onOpen: (card: MuseumCard) => void;
  onModeChange?: (mode: GalleryMode) => void;
  paused?: boolean;
  // Replace only the face; layout, travel and DOM identity stay with the gallery.
  renderCard?: (card: MuseumCard) => ReactNode;
};
type Transition = { start: number; from: Map<string, GalleryPose> };

export default function MuseumGallery({ cards, floatIds, onOpen, onModeChange, paused = false, renderCard }: Props) {
  const [viewMode, setViewMode] = useState<GalleryMode>("float");
  const [transitioning, setTransitioning] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<GalleryMode>("float");
  const pauseRef = useRef(paused);
  pauseRef.current = paused;
  const focusRef = useRef<string | null>(null);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchRef = useRef<(mode: GalleryMode) => void>(() => {});
  const advanceRef = useRef<(distance: number) => void>(() => {});
  const repaintRef = useRef<() => void>(() => {});
  const returningRef = useRef(new Set<string>());
  const hoverAfterRef = useRef(0);
  const uniqueCards = useMemo(() => {
    const seen = new Set<string>();
    return cards.filter(card => { if (seen.has(card.id)) return false; seen.add(card.id); return true; });
  }, [cards]);
  const cardsKey = uniqueCards.map(card => card.id).join("|");
  const cardsRef = useRef(uniqueCards);
  cardsRef.current = uniqueCards;
  const floatIdsRef = useRef<Set<string> | null>(null);
  floatIdsRef.current = floatIds ? new Set(floatIds) : null;
  const floatKey = floatIds?.join("|") ?? cardsKey;
  useEffect(() => { repaintRef.current(); }, [floatKey]);

  function focus(id: string | null) {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = null;
    if (focusRef.current && focusRef.current !== id) returningRef.current.add(focusRef.current);
    if (id) returningRef.current.delete(id);
    focusRef.current = id;
    setFocusedId(id);
    repaintRef.current();
  }
  function release() {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    // Allow the cursor time to follow the card as it moves toward the camera.
    releaseTimer.current = setTimeout(() => focus(null), 550);
  }
  function changeMode() {
    if (transitioning) return;
    const mode = viewMode === "float" ? "tunnel3D" : "float";
    focus(null);
    setViewMode(mode);
    switchRef.current(mode);
    onModeChange?.(mode);
  }

  useEffect(() => {
    const root = rootRef.current, stage = stageRef.current;
    if (!root || !stage) return;
    setTransitioning(false);
    focusRef.current = null;
    returningRef.current.clear();
    setFocusedId(null);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = new Map(Array.from(stage.querySelectorAll<HTMLElement>("[data-gallery-card]")).map(element => [element.dataset.galleryCard!, element]));
    const guides = Array.from(stage.querySelectorAll<HTMLElement>("[data-tunnel-ring]"));
    const poses = new Map<string, GalleryPose>();
    let width = root.clientWidth, height = root.clientHeight;
    let camera = 0, targetCamera = 0, seconds = 0, last = 0, frame = 0;
    let transition: Transition | null = null;
    let pointerX = 0, pointerY = 0, lookX = 0, lookY = 0;
    let touch: { id: number; y: number } | null = null;
    let disposed = false;
    const schedule = () => { if (!frame && !disposed) frame = requestAnimationFrame(paint); };
    repaintRef.current = schedule;
    const apply = (element: HTMLElement, pose: GalleryPose) => {
      element.style.transform = `translate3d(${pose.x}px,${pose.y}px,${pose.z}px) rotateX(${pose.rx}deg) rotateY(${pose.ry}deg) rotateZ(${pose.rz}deg)`;
      element.style.opacity = String(pose.opacity);
    };
    const paint = (now: number) => {
      frame = 0;
      const delta = last ? Math.min((now - last) / 1000, .05) : 1 / 60;
      last = now;
      if (document.hidden || pauseRef.current) { schedule(); return; }
      const motion = !reduced.matches;
      if (motion && !focusRef.current && !transition) seconds += delta;
      const damping = motion ? 1 - Math.exp(-delta * 7) : 1;
      if (!focusRef.current && !transition) camera += (targetCamera - camera) * damping;
      lookX += ((motion ? pointerX : 0) - lookX) * damping; lookY += ((motion ? pointerY : 0) - lookY) * damping;
      stage.style.transform = `translate3d(${lookX * 22}px,${lookY * 10}px,0) rotateY(${lookX * 2}deg) rotateX(${-lookY}deg)`;
      const progress = transition ? Math.min(1, (now - transition.start) / 900) : 1;
      const count = cardsRef.current.length;
      const floatCards = cardsRef.current.filter(card => !floatIdsRef.current || floatIdsRef.current.has(card.id));
      const floatIndex = new Map(floatCards.map((card, index) => [card.id, index]));
      cardsRef.current.forEach((card, index) => {
        const element = elements.get(card.id);
        if (!element) return;
        const inFloat = floatIndex.has(card.id);
        let destination = modeRef.current === "float"
          ? floatPose(floatIndex.get(card.id) ?? 0, floatCards.length, width, height, seconds)
          : tunnelPose(index, count, width, height, camera);
        if (modeRef.current === "float" && !inFloat) destination = { ...destination, opacity: 0 };
        if (transition) {
          const from = transition.from.get(card.id) || destination;
          const collapse: GalleryPose = { ...from, x: from.x * .08, y: from.y * .08, z: -2300 - index * 100, rz: from.rz + 12, opacity: .12 };
          // 0–450ms: collapse. 450–900ms: emerge into the destination layout.
          const local = progress < .5 ? progress * 2 : (progress - .5) * 2;
          const eased = local * local * (3 - 2 * local);
          destination = progress < .5 ? interpolatePose(from, collapse, eased) : interpolatePose(collapse, destination, eased);
        } else if (focusRef.current === card.id) {
          const previous = poses.get(card.id) || destination;
          const front = modeRef.current === "tunnel3D"
            ? { x: 0, y: -10, z: width < 760 ? 90 : 150, rx: 0, ry: 0, rz: 0, opacity: 1 }
            : { ...previous, rx: 0, ry: 0, rz: 0, opacity: 1 };
          destination = interpolatePose(previous, front, reduced.matches ? 1 : 1 - Math.exp(-delta * 11));
        } else if (returningRef.current.has(card.id)) {
          const previous = poses.get(card.id) || destination;
          const returned = interpolatePose(previous, destination, reduced.matches ? 1 : 1 - Math.exp(-delta * 12));
          if (Math.hypot(returned.x - destination.x, returned.y - destination.y, returned.z - destination.z) < 1) returningRef.current.delete(card.id);
          destination = returned;
        }
        poses.set(card.id, destination);
        apply(element, destination);
        element.hidden = modeRef.current === "float" && !inFloat && !transition;
        // Distant cards remain visible, but cannot steal clicks or keyboard focus.
        element.inert = Boolean(element.hidden || transition || (modeRef.current === "tunnel3D" && destination.z < -1700 && focusRef.current !== card.id));
      });
      const length = Math.max(1, count) * TUNNEL_SPACING;
      guides.forEach((ring, index) => {
        const z = TUNNEL_NEAR - (((index * length / guides.length - camera) % length + length) % length);
        ring.style.transform = `translate3d(-50%,-50%,${z}px)`;
        ring.style.opacity = String(Math.max(.08, 1 + z / length) * .22);
      });
      if (transition && progress >= 1) { transition = null; setTransitioning(false); }
      if (motion || transition || Math.abs(camera - targetCamera) > .1) schedule();
    };
    switchRef.current = mode => {
      modeRef.current = mode;
      camera = targetCamera = 0;
      if (reduced.matches) { transition = null; setTransitioning(false); }
      else { transition = { start: performance.now(), from: new Map(poses) }; setTransitioning(true); }
      schedule();
    };
    const advance = (distance: number) => {
      if (modeRef.current !== "tunnel3D" || transition || pauseRef.current) return;
      focus(null);
      hoverAfterRef.current = performance.now() + 250;
      targetCamera += Math.max(-1600, Math.min(1600, distance));
      schedule();
    };
    advanceRef.current = advance;
    const wheel = (event: WheelEvent) => {
      if (modeRef.current !== "tunnel3D" || event.ctrlKey || event.metaKey || pauseRef.current || (event.target as Element).closest("[data-gallery-controls]")) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
      advance(event.deltaY * unit * 2.3);
    };
    const pointerMove = (event: PointerEvent) => {
      if (touch?.id === event.pointerId) {
        advance((touch.y - event.clientY) * 5);
        touch.y = event.clientY;
        return;
      }
      if (event.pointerType !== "mouse") return;
      const rect = root.getBoundingClientRect();
      pointerX = (event.clientX - rect.left) / width * 2 - 1;
      pointerY = (event.clientY - rect.top) / height * 2 - 1;
      schedule();
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || modeRef.current !== "tunnel3D" || (event.target as Element).closest("button")) return;
      touch = { id: event.pointerId, y: event.clientY };
      root.setPointerCapture(event.pointerId);
    };
    const pointerEnd = (event: PointerEvent) => {
      if (touch?.id !== event.pointerId) return;
      touch = null;
      if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
    };
    const pointerLeave = () => { pointerX = pointerY = 0; focus(null); schedule(); };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { focus(null); schedule(); }
      if ((event.target as Element).closest("[data-gallery-controls]")) return;
      if (modeRef.current !== "tunnel3D") return;
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(event.key)) {
        event.preventDefault(); advance(["ArrowDown", "PageDown"].includes(event.key) ? 460 : -460);
      }
    };
    const resize = new ResizeObserver(() => { width = root.clientWidth; height = root.clientHeight; schedule(); });
    resize.observe(root);
    const preferenceChanged = () => { transition = null; setTransitioning(false); schedule(); };
    reduced.addEventListener("change", preferenceChanged);
    root.addEventListener("wheel", wheel, { passive: false });
    root.addEventListener("pointermove", pointerMove, { passive: true });
    root.addEventListener("pointerdown", pointerDown);
    root.addEventListener("pointerup", pointerEnd); root.addEventListener("pointercancel", pointerEnd);
    root.addEventListener("pointerleave", pointerLeave); root.addEventListener("keydown", keyDown);
    schedule();
    return () => {
      disposed = true; cancelAnimationFrame(frame); resize.disconnect();
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
      if (touch && root.hasPointerCapture(touch.id)) root.releasePointerCapture(touch.id);
      switchRef.current = () => {}; advanceRef.current = () => {}; repaintRef.current = () => {};
      root.removeEventListener("wheel", wheel); root.removeEventListener("pointermove", pointerMove);
      root.removeEventListener("pointerdown", pointerDown); root.removeEventListener("pointerup", pointerEnd);
      root.removeEventListener("pointercancel", pointerEnd); root.removeEventListener("pointerleave", pointerLeave);
      root.removeEventListener("keydown", keyDown); reduced.removeEventListener("change", preferenceChanged);
    };
  }, [cardsKey]);

  return <div ref={rootRef} className={`${styles.gallery} ${viewMode === "tunnel3D" ? styles.tunnel : ""} ${transitioning ? styles.warping : ""} ${focusedId ? styles.reading : ""}`} aria-label={viewMode === "float" ? "漂浮展览" : "记忆深渊隧道"}>
    <div className={styles.depthGlow} aria-hidden="true" />
    <div className={styles.warpFlash} aria-hidden="true" />
    <div className={styles.viewport}>
      <div className={styles.stage} ref={stageRef}>
        <div className={styles.guides} aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <div className={styles.ring} data-tunnel-ring key={index} />)}</div>
        {uniqueCards.map(card => <div key={card.id} data-gallery-card={card.id} className={`${styles.position} ${focusedId === card.id ? styles.focused : ""} ${focusedId && focusedId !== card.id ? styles.muted : ""}`}
          onPointerEnter={event => { if (event.pointerType === "mouse" && !transitioning && performance.now() > hoverAfterRef.current) focus(card.id); }} onPointerLeave={release}
          onFocus={() => focus(card.id)} onBlur={() => focus(null)}>
          {renderCard ? renderCard(card) : <CardItem card={card} onOpen={onOpen} />}
        </div>)}
      </div>
    </div>
    <div className={styles.controls} data-gallery-controls>
      <span className={styles.modeLabel}>{viewMode === "float" ? "01 / DRIFT" : "02 / MEMORY ABYSS"}</span>
      <button type="button" className="flex items-center gap-3" onClick={changeMode} disabled={transitioning || uniqueCards.length === 0} aria-pressed={viewMode === "tunnel3D"}>
        <span className={styles.wireCube} aria-hidden="true">◇</span>{transitioning ? "折跃中…" : viewMode === "float" ? "空间折跃" : "返回漂流"}<span aria-hidden="true">↗</span>
      </button>
    </div>
    {viewMode === "tunnel3D" && <div className={styles.navigation} data-gallery-controls>
      <p><span className={styles.desktopHint}>滚轮推进 · 悬停靠近 · 点击打开档案</span><span className={styles.mobileHint}>空白处上下滑动穿梭 · 轻点藏品阅读</span></p>
      <div><button type="button" onClick={() => advanceRef.current(-460)} disabled={transitioning} aria-label="后退一段隧道">← 后退</button><span aria-hidden="true">∞</span><button type="button" onClick={() => advanceRef.current(460)} disabled={transitioning} aria-label="前进一段隧道">前进 →</button></div>
    </div>}
    <span className="sr-only" role="status">{transitioning ? "正在切换展览空间" : viewMode === "tunnel3D" ? "已进入隧道，滚轮、方向键或滑动可前进后退" : "已返回漂浮展厅"}</span>
  </div>;
}
