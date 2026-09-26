"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Artifact, displayArtifactId } from "@/lib/artifact";
import { burstTitleParticles } from "@/lib/title-particles";
import { isExhibitionSample } from "@/lib/exhibition-catalog";

type Props = {
  artifacts: Artifact[];
  onOpen: (artifact: Artifact) => void;
  onSubmit: () => void;
};

const tracks = [
  {
    top: "-14%", duration: "72s", delay: "-27s", opacity: 0.48,
    cards: [
      { index: 1, depth: "-170px", tiltX: "-2deg", tiltY: "4deg", angle: "4deg", offset: "10px" },
      { index: 4, depth: "-200px", tiltX: "2deg", tiltY: "-5deg", angle: "-5deg", offset: "-24px" },
      { index: 7, depth: "-150px", tiltX: "-3deg", tiltY: "3deg", angle: "3deg", offset: "20px" },
      { index: 2, depth: "-190px", tiltX: "2deg", tiltY: "-4deg", angle: "-4deg", offset: "-14px" },
    ],
  },
  {
    top: "36%", duration: "58s", delay: "-13s", opacity: 0.76,
    cards: [
      { index: 3, depth: "-70px", tiltX: "2deg", tiltY: "-4deg", angle: "-4deg", offset: "-20px" },
      { index: 0, depth: "-35px", tiltX: "-2deg", tiltY: "5deg", angle: "5deg", offset: "16px" },
      { index: 6, depth: "-95px", tiltX: "3deg", tiltY: "-3deg", angle: "3deg", offset: "-10px" },
      { index: 5, depth: "-50px", tiltX: "-2deg", tiltY: "4deg", angle: "-5deg", offset: "18px" },
    ],
  },
  {
    top: "78%", duration: "48s", delay: "-35s", opacity: 0.9,
    cards: [
      { index: 2, depth: "55px", tiltX: "-2deg", tiltY: "5deg", angle: "5deg", offset: "14px" },
      { index: 7, depth: "30px", tiltX: "2deg", tiltY: "-4deg", angle: "-4deg", offset: "-18px" },
      { index: 0, depth: "70px", tiltX: "-3deg", tiltY: "4deg", angle: "-5deg", offset: "20px" },
      { index: 3, depth: "40px", tiltX: "2deg", tiltY: "-5deg", angle: "4deg", offset: "-12px" },
    ],
  },
];

const titleCharacters = Array.from("无意义博物馆");
function scatterVectors() {
  return titleCharacters.map((_, index) => {
    const angle = index / titleCharacters.length * Math.PI * 2 + (Math.random() - .5) * .4;
    const distance = 200 + Math.random() * 200;
    return { "--tx": `${Math.cos(angle) * distance}px`, "--ty": `${Math.sin(angle) * distance}px`, "--rot": `${Math.random() * 30 - 15}deg` } as CSSProperties;
  });
}

function ArtifactCard({ artifact, onOpen, tabIndex }: { artifact: Artifact; onOpen: (artifact: Artifact) => void; tabIndex?: number }) {
  return (
    <button type="button" className={`floating-artifact ${artifact.imageUrl ? "" : "artifact-text-card"}`} onClick={() => onOpen(artifact)} aria-label={`查看馆藏 ${artifact.title}`} tabIndex={tabIndex}>
      <span className="artifact-head"><span className="artifact-index">{displayArtifactId(artifact.id)}</span><span className="artifact-tag">{artifact.tag}</span></span>
      {artifact.imageUrl ? <>
        <span className="artifact-media"><img src={artifact.imageUrl} alt="" loading="lazy" /></span>
        <span className="artifact-summary"><strong className="artifact-title">{artifact.title}</strong><span className="artifact-excerpt">{artifact.desc}</span></span>
      </> : <span className={`artifact-text-body ${artifact.desc.length > 55 ? "is-long" : artifact.desc.length < 20 ? "is-short" : ""}`}>
        <span className="artifact-text-label">文字标本 / ORIGINAL MOMENT</span>
        <strong className="artifact-original">{artifact.desc}</strong>
        <span className="artifact-text-open">查看档案 ↗</span>
      </span>}
      <span className="artifact-foot"><span>{isExhibitionSample(artifact.id) ? "展陈样本 / 非用户投稿" : "公开投稿 / 准予封存"}</span><span>{artifact.date}</span></span>
      <span className="artifact-detail" aria-hidden="true">
        <span className="artifact-detail-label">ARCHIVE / {artifact.tag}</span>
        <strong>{artifact.title}</strong>
        <span>{artifact.desc}</span>
        <em>{artifact.appraisalConclusion}</em>
        <small>查看完整档案 ↗</small>
      </span>
    </button>
  );
}

export default function ArtifactStreamHero({ artifacts, onOpen, onSubmit }: Props) {
  const sceneRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  const particlesRef = useRef<HTMLCanvasElement>(null);
  const stopParticlesRef = useRef<() => void>(() => {});
  const pickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDispersed, setIsDispersed] = useState(false);
  const [vectors, setVectors] = useState<CSSProperties[]>([]);
  const [batch, setBatch] = useState(0);
  const publicArtifacts = artifacts.filter((artifact, index, list) => artifact.isPublic && list.findIndex(item => item.id === artifact.id) === index);
  const batchCount = Math.max(1, Math.ceil(publicArtifacts.length / 8));
  const currentBatch = Math.min(batch, batchCount - 1);
  const visibleArtifacts = publicArtifacts.slice(currentBatch * 8, currentBatch * 8 + 8);
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
    if (isDispersed) restoreRef.current?.focus({ preventScroll: true });
  }, [isDispersed]);
  useEffect(() => () => {
    if (pickTimerRef.current) clearTimeout(pickTimerRef.current);
    stopParticlesRef.current();
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const stage = stageRef.current;
    const hero = heroRef.current;
    if (!scene || !stage || !hero) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motion = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let frame = 0;
    const canMove = () => !reducedMotion.matches && finePointer.matches;

    const animate = () => {
      motion.x += (motion.targetX - motion.x) * 0.085;
      motion.y += (motion.targetY - motion.y) * 0.085;
      stage.style.transform = `translate3d(${motion.x * 38}px, ${motion.y * 16}px, 0) rotateX(${-motion.y * 3.5}deg) rotateY(${motion.x * 5}deg)`;
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
      stage.style.transform = "";
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
    <section className={`stream-scene ${isDispersed ? "is-dispersed" : ""}`} aria-label="漂流展厅" ref={sceneRef}>
      <div className="stream-perspective">
        <div className="stream-focus">
        <div className="stream-stage" ref={stageRef}>
          {tracks.map((track, trackIndex) => (
            <div className={`stream-track stream-track-${trackIndex}`} key={trackIndex} style={{ top: track.top, "--rest-opacity": track.opacity } as CSSProperties}>
                    {visibleArtifacts.filter((_, index) => index % tracks.length === trackIndex).map((artifact, cardIndex, lane) => {
                      const card = track.cards[cardIndex % track.cards.length];
                      const style = {
                        "--depth": card.depth,
                        "--tilt-x": card.tiltX,
                        "--tilt-y": card.tiltY,
                        "--angle": card.angle,
                        "--offset": card.offset,
                      } as CSSProperties;
                      const duration = parseFloat(track.duration);
                      return <div className="stream-orbit" key={artifact.id} style={{ "--still-position": cardIndex, animationDuration: track.duration, animationDelay: `${-duration * ((cardIndex + .45) / lane.length)}s` } as CSSProperties}><div className="artifact-slot" style={style}><ArtifactCard artifact={artifact} onOpen={onOpen} /></div></div>;
                    })}
            </div>
          ))}
        </div>
        </div>
      </div>

      <div className="hero-center" ref={heroRef}>
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
      {isDispersed && <button type="button" className="hero-restore" ref={restoreRef} onClick={restore}><span aria-hidden="true">↶</span> 还原标题</button>}
      <p className="sr-only" role="status">{isDispersed ? "标题已散开，可以浏览漂浮藏品，或点击还原标题。" : "标题已聚拢。"}</p>

      <div className="stream-catalog-control" aria-label="浏览全部公开馆藏">
        <span>馆藏 {publicArtifacts.length} 件 · 第 {currentBatch + 1}/{batchCount} 批</span>
        {batchCount > 1 && <button type="button" onClick={() => setBatch((currentBatch + 1) % batchCount)}>换一批藏品 ↻</button>}
      </div>
      <div className="scene-coordinate scene-coordinate-left">MOM / EVERYDAY ARCHIVE</div>
      <div className="scene-coordinate scene-coordinate-right">PUBLIC ARCHIVE · IN MOTION</div>
    </section>
  );
}
