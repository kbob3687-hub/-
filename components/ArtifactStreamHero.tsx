"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Artifact, displayArtifactId } from "@/lib/artifact";
import { burstTitleParticles } from "@/lib/title-particles";
import MuseumGallery from "@/components/MuseumGallery";
import CardItem from "@/components/CardItem";
import { EXHIBITION_BATCH_SIZE } from "@/lib/exhibition-catalog";

type Props = {
  artifacts: Artifact[];
  onOpen: (artifact: Artifact) => void;
  onSubmit: () => void;
  paused?: boolean;
};

const titleCharacters = Array.from("无意义博物馆");
function scatterVectors() {
  return titleCharacters.map((_, index) => {
    const angle = index / titleCharacters.length * Math.PI * 2 + (Math.random() - .5) * .4;
    const distance = 200 + Math.random() * 200;
    return { "--tx": `${Math.cos(angle) * distance}px`, "--ty": `${Math.sin(angle) * distance}px`, "--rot": `${Math.random() * 30 - 15}deg` } as CSSProperties;
  });
}

export default function ArtifactStreamHero({ artifacts, onOpen, onSubmit, paused = false }: Props) {
  const sceneRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  const particlesRef = useRef<HTMLCanvasElement>(null);
  const stopParticlesRef = useRef<() => void>(() => {});
  const pickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDispersed, setIsDispersed] = useState(false);
  const [isTunnel, setIsTunnel] = useState(false);
  const [vectors, setVectors] = useState<CSSProperties[]>([]);
  const [batch, setBatch] = useState(0);
  const publicArtifacts = artifacts.filter((artifact, index, list) => artifact.isPublic && list.findIndex(item => item.id === artifact.id) === index);
  const batchCount = Math.max(1, Math.ceil(publicArtifacts.length / EXHIBITION_BATCH_SIZE));
  const currentBatch = Math.min(batch, batchCount - 1);
  const visibleArtifacts = publicArtifacts.slice(currentBatch * EXHIBITION_BATCH_SIZE, (currentBatch + 1) * EXHIBITION_BATCH_SIZE);
  useEffect(() => { setBatch(0); }, [artifacts[0]?.id]);
  const disperse = () => {
    stopParticlesRef.current();
    if (sceneRef.current && particlesRef.current && titleRef.current) {
      stopParticlesRef.current = burstTitleParticles(sceneRef.current,
        Array.from(titleRef.current.querySelectorAll<HTMLElement>(".hero-title-character")), particlesRef.current);
    }
    setVectors(scatterVectors());
    setIsDispersed(true);
  };
  const restore = () => {
    stopParticlesRef.current();
    if (pickTimerRef.current) clearTimeout(pickTimerRef.current);
    pickTimerRef.current = null;
    setIsDispersed(false);
    requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
  };
  const pickOne = () => {
    if (!publicArtifacts.length || pickTimerRef.current) return;
    const artifact = publicArtifacts[Math.floor(Math.random() * publicArtifacts.length)];
    disperse();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    pickTimerRef.current = setTimeout(() => {
      pickTimerRef.current = null;
      onOpen(artifact);
    }, reduced ? 100 : 1600);
  };

  useEffect(() => {
    if (isDispersed && !isTunnel) restoreRef.current?.focus({ preventScroll: true });
  }, [isDispersed, isTunnel]);
  useEffect(() => () => {
    if (pickTimerRef.current) clearTimeout(pickTimerRef.current);
    stopParticlesRef.current();
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const hero = heroRef.current;
    if (!scene || !hero) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motion = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let frame = 0;
    const canMove = () => !reducedMotion.matches && finePointer.matches;

    const animate = () => {
      motion.x += (motion.targetX - motion.x) * 0.085;
      motion.y += (motion.targetY - motion.y) * 0.085;
      hero.style.transform = `translate3d(${-motion.x * 10}px, ${-motion.y * 5}px, 0)`;

      if (Math.max(Math.abs(motion.targetX - motion.x), Math.abs(motion.targetY - motion.y)) > 0.001) {
        frame = window.requestAnimationFrame(animate);
      } else {
        frame = 0;
      }
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(animate); };
    const onMove = (event: PointerEvent) => {
      if (!canMove() || event.pointerType !== "mouse") return;
      const bounds = scene.getBoundingClientRect();
      motion.targetX = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
      motion.targetY = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
      schedule();
    };
    const onLeave = () => { motion.targetX = 0; motion.targetY = 0; schedule(); };
    const onPreferenceChange = () => {
      if (canMove()) return;
      window.cancelAnimationFrame(frame);
      frame = 0;
      motion.x = motion.y = motion.targetX = motion.targetY = 0;
      hero.style.transform = "";
    };

    scene.addEventListener("pointermove", onMove, { passive: true });
    scene.addEventListener("pointerleave", onLeave);
    reducedMotion.addEventListener("change", onPreferenceChange);
    finePointer.addEventListener("change", onPreferenceChange);
    return () => {
      window.cancelAnimationFrame(frame);
      scene.removeEventListener("pointermove", onMove);
      scene.removeEventListener("pointerleave", onLeave);
      reducedMotion.removeEventListener("change", onPreferenceChange);
      finePointer.removeEventListener("change", onPreferenceChange);
    };
  }, []);

  return (
    <section className={`stream-scene ${isDispersed ? "is-dispersed" : ""} ${isTunnel ? "is-tunnel" : ""}`} aria-label="漂流展厅" ref={sceneRef}>
      <MuseumGallery
        cards={publicArtifacts.map(artifact => ({ id: artifact.id, code: displayArtifactId(artifact.id), title: artifact.title, excerpt: artifact.desc, imageUrl: artifact.imageUrl, date: artifact.date, type: artifact.tag }))}
        floatIds={visibleArtifacts.map(artifact => artifact.id)}
        paused={paused}
        onOpen={card => { const artifact = publicArtifacts.find(item => item.id === card.id); if (artifact) onOpen(artifact); }}
        renderCard={card => {
          const artifact = publicArtifacts.find(item => item.id === card.id);
          return <CardItem card={card} conclusion={artifact?.appraisalConclusion} onOpen={() => { if (artifact) onOpen(artifact); }} />;
        }}
        onModeChange={mode => { setIsTunnel(mode === "tunnel3D"); if (mode === "tunnel3D") disperse(); else restore(); }}
      />

      <div className="hero-center" ref={heroRef} inert={isTunnel} aria-hidden={isTunnel}>
        <p className="eyebrow hero-recedes" aria-hidden={isDispersed}><span className="red-line" /> 日常小事常设展 <span className="red-line" /></p>
        <h1 aria-label="无意义博物馆"><button type="button" className="hero-title-trigger" ref={titleRef} onClick={disperse} disabled={isDispersed} aria-label="无意义博物馆，点击让标题散开查看展品"><span className="sr-only">无意义博物馆</span>{titleCharacters.map((character, index) => <span aria-hidden="true" className="hero-title-character" key={index} style={vectors[index]}>{character}</span>)}</button></h1>
        <p className="hero-english hero-recedes" aria-hidden={isDispersed}>MUSEUM OF MEANINGLESS THINGS</p>
        <p className="hero-copy hero-recedes" aria-hidden={isDispersed}>一条写了又删的消息，一张拍糊的照片，<br className="desktop-break" />一次走错路后的绕远，一整个什么也没做的下午。<br className="desktop-break" />这些小事没有结果，这里也愿意为它们留一个位置。</p>
        <div className="hero-actions hero-recedes" inert={isDispersed}>
          <button type="button" className="primary-cta" onClick={onSubmit}><span aria-hidden="true">＋</span> 给小事留个位置</button>
          <button type="button" className="hero-pick" onClick={pickOne} disabled={!visibleArtifacts.length}><span aria-hidden="true">◎</span> 拾取一件藏品</button>
        </div>
        <p className="hero-hint hero-recedes" aria-hidden={isDispersed}><span className="hero-hint-desktop">悬停卡片可读详情 · 点击卡片打开档案</span><span className="hero-hint-mobile">卡片正在缓慢漂流 · 轻点卡片打开档案</span></p>
      </div>

      <canvas className="hero-particles" ref={particlesRef} aria-hidden="true" />
      {isDispersed && !isTunnel && <button type="button" className="hero-restore" ref={restoreRef} onClick={restore}><span aria-hidden="true">↶</span> 还原标题</button>}
      <p className="sr-only" role="status">{isTunnel ? "已进入记忆深渊，可通过返回漂流聚拢标题。" : isDispersed ? "标题已散开，可以浏览漂浮藏品，或点击还原标题。" : "标题已聚拢。"}</p>

      <div className="stream-catalog-control" aria-label="浏览当前展陈">
        <span>{isTunnel ? `全部展陈 ${publicArtifacts.length} 件 · 滚轮穿梭浏览` : `展陈 ${publicArtifacts.length} 件 · 第 ${currentBatch + 1}/${batchCount} 批`}</span>
        {!isTunnel && batchCount > 1 && <button type="button" onClick={() => setBatch((currentBatch + 1) % batchCount)}>换一批藏品 ↻</button>}
      </div>
      <div className="scene-coordinate scene-coordinate-left">MOM / EVERYDAY ARCHIVE</div>
      <div className="scene-coordinate scene-coordinate-right">PUBLIC ARCHIVE · IN MOTION</div>
    </section>
  );
}
