"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState, type CSSProperties } from "react";
import { exportTicket } from "@/lib/export-ticket";
import { Artifact, ArtifactDraft, makeArtifact } from "@/lib/artifact";
import { isProductiveSubmission, offlineAppraisal } from "@/lib/offline-appraisal";
import { savePersonalArtifact } from "@/lib/private-archive";
import ArchivalTicket from "@/components/ArchivalTicket";
import ReceiptPreview from "@/components/ReceiptPreview";
import { prepareImage } from "@/lib/prepare-image";
import { hasExhibitionDetail } from "@/lib/exhibition-catalog";

export type AppraisalFormDraft = { desc: string; title: string; isPublic: boolean; allowResonanceModel: boolean; imageUrl?: string };
type Props = { onClose: () => void; onCreated: (artifact: Artifact) => void; onArchived: (artifact: Artifact) => void; onOpenPrivateArchive: (id: string) => void; initialDraft?: AppraisalFormDraft | null; onExploreResonance: (draft: AppraisalFormDraft) => void };
type Stage = "input" | "scan" | "print" | "stamp" | "ready" | "confirmed" | "releasing" | "rejected";
type Flight = { left: number; top: number; width: number; height: number; x: number; y: number };
const SCAN_MS = 2200;
const PRINT_MS = 1100;
const STAMP_MS = 700;
const inspectionLogs = [
  "[00:00] 标本接入 / 正在核对存在痕迹……",
  "[00:01] 正在检查内容与展览主题……",
  "[00:01] 寻找没有明确产出的生活切片……",
  "[00:02] 不按心情好坏决定入馆资格。",
  "[00:02] 等待检查与编目结果，请保持原状……",
];
const writingPrompts = [
  { label: "没说出口的话", question: "有没有一句写了又删掉的话？" },
  { label: "白等的一会儿", question: "今天有没有一段只是等待的时间？" },
  { label: "留下的东西", question: "有没有一件保存下来却没再用过的东西？" },
  { label: "没照计划发生", question: "有没有一件认真安排却没照计划发生的小事？" },
];
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export default function AppraisalModal({ onClose, onCreated, onArchived, onOpenPrivateArchive, initialDraft, onExploreResonance }: Props) {
  const [stage, setStage] = useState<Stage>("input");
  const [desc, setDesc] = useState(initialDraft?.desc ?? "");
  const [writingPrompt, setWritingPrompt] = useState<(typeof writingPrompts)[number] | null>(null);
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [isPublic, setIsPublic] = useState(initialDraft?.isPublic ?? true);
  const [allowResonanceModel, setAllowResonanceModel] = useState(initialDraft?.allowResonanceModel ?? true);
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialDraft?.imageUrl);
  const [error, setError] = useState("");
  const [rejection, setRejection] = useState({ title: "暂不符合展览主题", message: "请换一段没有明确产出的生活切片；开心的小事也可以入馆。" });
  const [loadingStep, setLoadingStep] = useState(0);
  const [saved, setSaved] = useState<Artifact | null>(null);
  const [pendingDraft, setPendingDraft] = useState<ArtifactDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);
  const [processingImage, setProcessingImage] = useState(false);
  const imageRequestRef = useRef(0);
  const [archiveSaved, setArchiveSaved] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [retryingArchive, setRetryingArchive] = useState(false);
  const [source, setSource] = useState<"ai" | "offline">("offline");
  const [exportUrl, setExportUrl] = useState("");
  const [flight, setFlight] = useState<Flight | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const aliveRef = useRef(true);
  const busy = saving || retryingArchive || stage === "scan" || stage === "print" || stage === "stamp" || stage === "releasing";
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  const exportRef = useRef(exportUrl);
  busyRef.current = busy;
  onCloseRef.current = onClose;
  exportRef.current = exportUrl;

  useEffect(() => {
    aliveRef.current = true;
    const previous = document.activeElement as HTMLElement | null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (exportRef.current) setExportUrl("");
      else if (!busyRef.current) onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      aliveRef.current = false;
      document.body.style.overflow = priorOverflow;
      window.removeEventListener("keydown", onKeyDown);
      void audioRef.current?.close();
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    if (stage !== "scan") return;
    const interval = window.setInterval(() => setLoadingStep((step) => Math.min(step + 1, inspectionLogs.length - 1)), 420);
    return () => window.clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    if (stage !== "stamp") return;
    ticketRef.current?.scrollIntoView({ block: "end", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [stage]);

  useEffect(() => {
    if (stage !== "ready") return;
    dialogRef.current?.scrollTo({ top: dialogRef.current.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [stage]);

  function soundEnabled() { return !window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

  async function prepareAudio() {
    if (!soundEnabled()) return;
    try {
      audioRef.current ??= new AudioContext();
      await audioRef.current.resume();
    } catch { /* Silent browsers still get the full visual sequence. */ }
  }

  function playPrinter() {
    const audio = audioRef.current;
    if (!audio || audio.state !== "running" || !soundEnabled()) return;
    const start = audio.currentTime;
    [0, 0.24, 0.51, 0.75, 0.96].forEach((offset) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(110, start + offset);
      oscillator.frequency.exponentialRampToValueAtTime(72, start + offset + 0.075);
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.025, start + offset + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.09);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.1);
    });
  }

  function playStamp() {
    const audio = audioRef.current;
    if (!audio || audio.state !== "running" || !soundEnabled()) return;
    const start = audio.currentTime;
    const oscillator = audio.createOscillator();
    const bass = audio.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(132, start);
    oscillator.frequency.exponentialRampToValueAtTime(42, start + 0.4);
    bass.gain.setValueAtTime(0.0001, start);
    bass.gain.exponentialRampToValueAtTime(0.3, start + 0.014);
    bass.gain.exponentialRampToValueAtTime(0.0001, start + 0.46);
    oscillator.connect(bass).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.47);

    const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.24), audio.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index++) channel[index] = (Math.random() * 2 - 1) * Math.exp(-index / (audio.sampleRate * 0.047));
    const noise = audio.createBufferSource();
    const metallic = audio.createBiquadFilter();
    const noiseGain = audio.createGain();
    noise.buffer = buffer;
    metallic.type = "bandpass";
    metallic.frequency.value = 720;
    metallic.Q.value = 0.65;
    noiseGain.gain.value = 0.26;
    noise.connect(metallic).connect(noiseGain).connect(audio.destination);
    noise.start(start);
  }

  function playWhoosh() {
    const audio = audioRef.current;
    if (!audio || audio.state !== "running" || !soundEnabled()) return;
    const start = audio.currentTime;
    const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.6), audio.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index++) channel[index] = Math.random() * 2 - 1;
    const noise = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    noise.buffer = buffer;
    filter.type = "bandpass";
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(180, start);
    filter.frequency.exponentialRampToValueAtTime(1600, start + 0.48);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.11, start + 0.13);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.58);
    noise.connect(filter).connect(gain).connect(audio.destination);
    noise.start(start);
    noise.stop(start + 0.6);
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    const request = ++imageRequestRef.current;
    setProcessingImage(true);
    setError("");
    try {
      const result = await prepareImage(file);
      if (aliveRef.current && request === imageRequestRef.current) setImageUrl(result);
    } catch (reason) {
      if (aliveRef.current && request === imageRequestRef.current) setError(reason instanceof Error ? reason.message : "照片处理失败，请重试。");
    } finally {
      if (aliveRef.current && request === imageRequestRef.current) setProcessingImage(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (processingImage) return;
    setError("");
    if (desc.trim().length < 4) { setError("请至少写下 4 个字。"); return; }
    if (!isPublic && isProductiveSubmission(desc)) {
      setRejection({ title: "暂不符合展览主题", message: "请换一段没有明确产出的生活切片；开心的小事也可以入馆。" });
      setStage("rejected"); return;
    }
    void prepareAudio();
    setLoadingStep(0);
    setArchiveSaved(false);
    setArchiveError("");
    setStage("scan");
    const start = performance.now();
    try {
      let artifact: Artifact;
      let draft: ArtifactDraft;
      let appraisalSource: "ai" | "offline" = "offline";
      if (isPublic) {
        const response = await fetch("/api/appraise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ desc: desc.trim(), title: title.trim(), imageUrl, isPublic: true }),
        });
        const data = await response.json();
        if (response.status === 422 && data.rejected) {
          setRejection({ title: data.reason === "safety" ? "未通过公开展示审核" : "暂不符合展览主题", message: data.error });
          setStage("rejected"); return;
        }
        if (!response.ok) throw new Error(data.error || "鉴定失败。");
        appraisalSource = data.source;
        draft = data.draft;
        artifact = { ...makeArtifact(draft, 0), id: "确认封存后生成编号" };
      } else {
        draft = offlineAppraisal({ desc: desc.trim(), title: title.trim(), imageUrl, isPublic: false });
        artifact = {
          ...makeArtifact(draft, 0),
          id: `MOM-DEEP-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`,
        };
      }
      await wait(Math.max(0, SCAN_MS - (performance.now() - start)));
      if (!aliveRef.current) return;
      setSaved(artifact);
      setPendingDraft(draft);
      setSource(appraisalSource);
      setStage("print");
      playPrinter();
      await wait(PRINT_MS);
      if (!aliveRef.current) return;
      setStage("stamp");
      playStamp();
      await wait(STAMP_MS);
      if (aliveRef.current) setStage("ready");
    } catch (reason) {
      if (!aliveRef.current) return;
      setError(reason instanceof Error ? reason.message : "鉴定失败，请重试。");
      setStage("input");
    }
  }

  async function download() {
    if (!ticketRef.current || !saved) return;
    setError("");
    try {
      const url = await exportTicket(ticketRef.current);
      setExportUrl(url);
    } catch {
      setError("凭证图片导出失败。请截图保存。");
    }
  }

  async function retryArchive() {
    if (!saved || retryingArchive) return;
    setRetryingArchive(true);
    try {
      await savePersonalArtifact(saved);
      if (aliveRef.current) { setArchiveSaved(true); setArchiveError(""); onArchived(saved); }
    } catch (reason) {
      if (aliveRef.current) setArchiveError(reason instanceof Error ? reason.message : "本机历史保存失败，请重试。");
    } finally { if (aliveRef.current) setRetryingArchive(false); }
  }

  async function release() {
    if (!saved || !pendingDraft || !ticketRef.current || saving) return;
    setError("");
    setSaving(true);
    let artifact = saved;
    try {
      if (saved.isPublic) {
        const response = await fetch("/api/artifacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pendingDraft),
        });
        const data = await response.json();
        if (response.status === 422 && data.rejected) {
          setRejection({ title: data.reason === "safety" ? "未通过公开展示审核" : "暂不符合展览主题", message: data.error });
          setStage("rejected"); setSaving(false); return;
        }
        if (!response.ok) throw new Error(data.error || "入库失败，请重试。");
        artifact = data.artifact;
        try {
          await savePersonalArtifact(artifact);
          if (aliveRef.current) setArchiveSaved(true);
        } catch (reason) {
          if (aliveRef.current) setArchiveError(`已入公共展厅，但本机历史未保存。${reason instanceof Error ? reason.message : "请重试保存历史。"}`);
        }
      } else {
        await savePersonalArtifact(saved);
        setArchiveSaved(true);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "入库失败，请重试。");
      setSaving(false);
      return;
    }
    if (!aliveRef.current) return;
    setSaved(artifact);
    if (artifact.isPublic) onCreated(artifact);
    if (!artifact.isPublic) onArchived(artifact);
    setSaving(false);
    setStage("confirmed");
  }

  function finish() {
    if (!saved || !ticketRef.current) { onClose(); return; }
    const rect = ticketRef.current.getBoundingClientRect();
    const scene = document.querySelector(".stream-scene")?.getBoundingClientRect();
    const archiveTrigger = Array.from(document.querySelectorAll(".private-archive-trigger"))
      .map((element) => element.getBoundingClientRect())
      .find((bounds) => bounds.width > 0 && bounds.top >= 0 && bounds.bottom <= window.innerHeight);
    const exhibited = saved.isPublic && hasExhibitionDetail(saved);
    const targetX = exhibited ? (scene ? scene.left + scene.width * 0.76 : window.innerWidth * 0.76) : (archiveTrigger ? archiveTrigger.left + archiveTrigger.width / 2 : window.innerWidth - 58);
    const targetY = exhibited ? (scene ? scene.top + scene.height * 0.46 : window.innerHeight * 0.48) : (archiveTrigger ? archiveTrigger.top + archiveTrigger.height / 2 : window.innerHeight - 46);
    setExportUrl("");
    playWhoosh();
    setFlight({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, x: targetX - rect.left - rect.width / 2, y: targetY - rect.top - rect.height / 2 });
    setStage("releasing");
    window.setTimeout(() => {
      if (!aliveRef.current) return;
      if (archiveSaved && saved.isPublic) onArchived(saved);
      onClose();
      if (!exhibited && archiveSaved) onOpenPrivateArchive(saved.id);
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 180 : 850);
  }

  return (
    <div className={`modal-backdrop ${stage === "releasing" ? "backdrop-releasing" : ""}`} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className={`appraisal-modal ${stage === "stamp" ? "stamp-impact" : ""}`} role="dialog" aria-modal="true" aria-label="入藏鉴定" tabIndex={-1} ref={dialogRef}>
        <div className="modal-top"><span>MOM / ARCHIVAL PROCESS</span><button type="button" onClick={onClose} disabled={busy} aria-label="关闭入藏窗口">×</button></div>
        {stage === "input" && (
          <form className="appraisal-form" onSubmit={submit}>
            <p className="form-kicker">NO. 01 / 提交标本</p>
            <h2>给小事留个位置</h2>
            <p className="form-intro">它可以是一个动作、一张拍糊的照片，或一段没有去处的时间。</p>
            <div className="writing-prompts" aria-label="写作提示"><p>不知道写什么？从这里想起一件：</p><div>{writingPrompts.map((prompt) => <button key={prompt.label} type="button" className={writingPrompt?.label === prompt.label ? "active" : ""} onClick={() => { setWritingPrompt(prompt); descRef.current?.focus(); }}>{prompt.label}</button>)}</div>{writingPrompt && <span>{writingPrompt.question}</span>}</div>
            <label htmlFor="desc">发生了什么 <span>必填 · 4—280 字</span></label>
            <textarea id="desc" ref={descRef} value={desc} onChange={(event) => setDesc(event.target.value)} maxLength={280} placeholder={writingPrompt ? "写下你想起的那件小事，具体一点就好。" : "例如：凌晨两点，外卖盒角落的辣油已经凝住了。"} required />
            <div className="input-counter">{desc.length} / 280</div>
            <label htmlFor="title">给它一个名字 <span>可留空，由编目官定名</span></label>
            <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={30} placeholder="可选" />
            <label className="upload-label" htmlFor="image">{processingImage ? "正在整理照片，请稍候…" : imageUrl ? "✓ 照片已附在档案里 · 点击更换" : "+ 附上一张照片（可选）"}</label>
            <input id="image" className="sr-only" type="file" accept="image/*,.heic,.heif" onChange={handleImage} />
            <p className="upload-note" role="status">支持日常照片、截图及 HEIC，单张最多 30 MB；自动优化后入藏。</p>
            {imageUrl && <div className="upload-preview"><img src={imageUrl} alt="待入藏照片预览" /><button type="button" onClick={() => { imageRequestRef.current++; setProcessingImage(false); setImageUrl(undefined); }}>移除照片</button></div>}
            <fieldset className="privacy-fieldset"><legend>入藏方式</legend>
              <label className={isPublic ? "privacy-option selected" : "privacy-option"}><input type="radio" checked={isPublic} onChange={() => setIsPublic(true)} /><strong>公开常设展</strong><span>公开展示，并在我的深库保留副本</span></label>
              <label className={!isPublic ? "privacy-option selected" : "privacy-option"}><input type="radio" checked={!isPublic} onChange={() => setIsPublic(false)} /><strong>深库特藏</strong><span>本机离线编目，不上传任何内容</span></label>
            </fieldset>
            <p className="privacy-note">{isPublic ? "公开展品会展示原话和照片，并交由审核服务检查文字与图片。请勿填写姓名、电话或其他人的隐私信息。" : "深库特藏仅保存在此设备、此浏览器，不发送至公开投稿审核服务；清理浏览器数据后可能无法找回。"}</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="submit-cta" type="submit" disabled={processingImage}>{processingImage ? "照片处理中…" : "生成鉴定预览"} <span>→</span></button>
          </form>
        )}
        {stage === "scan" && (
          <div className="appraisal-loading" aria-live="polite">
            <p className="form-kicker">NO. 02 / 无用性质检 · TERMINAL 01</p>
            <div className="quality-terminal">
              <div className="terminal-header"><span><i /> SYSTEM ONLINE</span><span>SCAN / {String(loadingStep + 1).padStart(2, "0")}</span></div>
              <div className="terminal-scanline" aria-hidden="true" />
              <div className="terminal-logs">{inspectionLogs.slice(0, loadingStep + 1).map((line) => <p key={line}>{line}</p>)}<span className="terminal-cursor" aria-hidden="true">▌</span></div>
              <div className="terminal-progress"><span style={{ width: `${(loadingStep + 1) * 20}%` }} /></div>
            </div>
            <p className="inspection-caption">{isPublic ? "正在审核文字与物证，通过后才会出票。" : "正在本机编目，这件小事不会送入公共展厅。"}</p>
          </div>
        )}
        {stage === "rejected" && (
          <div className="rejection-screen">
            <p className="form-kicker">ARCHIVE CONTROL / RED ALERT</p>
            <div className="rejection-symbol" aria-hidden="true">×</div>
            <h2>{rejection.title}</h2>
            <p>{rejection.message}</p>
            <button type="button" className="submit-cta" onClick={() => setStage("input")}>重新申报 <span>↶</span></button>
          </div>
        )}
        {(stage === "print" || stage === "stamp" || stage === "ready" || stage === "confirmed" || stage === "releasing") && saved && (
          <div className={`ticket-stage ticket-stage-${stage}`}>
            <p className="form-kicker">NO. 03 / {stage === "print" ? "机械出票中" : stage === "confirmed" || stage === "releasing" ? "正式入库凭证" : "鉴定预览 · 等待你确认"}</p>
            <div className="printer-slot" aria-hidden="true"><span>XI&apos;AN OLD STEEL FACTORY / RECEIPT 01</span></div>
            <div className="receipt-feed"><ArchivalTicket ref={ticketRef} artifact={saved} source={source} stamped={stage !== "print"} showOriginal={showOriginal} preview={stage === "print" || stage === "stamp" || stage === "ready"} /></div>
            {(stage === "ready" || stage === "confirmed") && (
              <>
                <p className="receipt-note" role="status">{stage === "confirmed" ? saved.isPublic ? hasExhibitionDetail(saved) ? archiveSaved ? "已入公共展厅，并在本机深库留存。你可以保存正式凭证。" : "已入公共展厅，但本机历史尚未保存。" : archiveSaved ? "已公开入库，并在本机深库留存。这份概括暂不展出，可在深库查看。" : "已公开入库，这份概括暂不展出；本机历史尚未保存，请重试。" : "已保存到此浏览器的私人深库。你可以保存正式凭证。" : saved.isPublic ? "请先核对原话和照片。确认后公开入库；有具体细节的小事进入展厅与星图。" : "请先核对这张凭证。确认后才会保存到此浏览器的私人深库。"}</p>
                {archiveError && <div role="alert"><p className="form-error">{archiveError}</p><button type="button" className="ticket-save-button" disabled={retryingArchive} onClick={retryArchive}>{retryingArchive ? "正在保存历史…" : "重试保存至我的深库"}</button></div>}
                {error && <p className="form-error" role="alert">{error}</p>}
                <div className="ticket-actions">
                  <label className="ticket-privacy-toggle"><input type="checkbox" checked={!showOriginal} onChange={(event) => setShowOriginal(!event.target.checked)} /> 分享凭证时隐藏我的原话</label>
                  <button type="button" className="ticket-save-button" onClick={download}>↓ 保存凭证图片</button>
                  {stage === "ready"
                    ? <button type="button" className="submit-cta" onClick={() => void release()} disabled={saving}>{saving ? "正在封存…" : saved.isPublic ? "确认公开入库" : "确认封存至我的深库"} <span>→</span></button>
                    : <button type="button" className="submit-cta" onClick={finish} disabled={retryingArchive}>{saved.isPublic && hasExhibitionDetail(saved) ? "返回展厅" : "查看我的深库"} <span>→</span></button>}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {exportUrl && <ReceiptPreview url={exportUrl} fileName={`${saved?.id.replace(/[^\w-]/g, "-") || "museum-receipt"}.png`} onClose={() => setExportUrl("")} />}
      {flight && stage === "releasing" && saved && (
        <div className="release-layer" aria-hidden="true">
          <div className="release-paper" style={{ left: flight.left, top: flight.top, width: flight.width, "--fly-x": `${flight.x}px`, "--fly-y": `${flight.y}px` } as CSSProperties}>
            <ArchivalTicket artifact={saved} source={source} stamped showOriginal={showOriginal} />
          </div>
          <span className="release-spark" style={{ left: flight.left + flight.width / 2, top: flight.top + flight.height / 2, "--fly-x": `${flight.x}px`, "--fly-y": `${flight.y}px` } as CSSProperties} />
        </div>
      )}
    </div>
  );
}
