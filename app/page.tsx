"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import ArtifactStreamHero from "@/components/ArtifactStreamHero";
import VoidConstellation from "@/components/VoidConstellation";
import AppraisalModal, { type AppraisalFormDraft } from "@/components/AppraisalModal";
import PrivateArchiveDrawer from "@/components/PrivateArchiveDrawer";
import AncientResonance from "@/components/AncientResonance";
import { Artifact, displayArtifactId, seedArtifacts } from "@/lib/artifact";
import { listPersonalArtifacts, PRIVATE_ARCHIVE_CHANGED } from "@/lib/private-archive";
import { createExperienceLinks, strongestConnections } from "@/lib/resonance";
import { createExhibitionCatalog, isExhibitionSample } from "@/lib/exhibition-catalog";

type View = "stream" | "constellation" | "ancient";
const LAST_PUBLIC_ARRIVAL = "mom-last-public-arrival";

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname.endsWith(".localhost") ||
    hostname === "[::1]" || hostname === "0.0.0.0" || /^127\./.test(hostname);
}

export default function HomePage() {
  const [view, setView] = useState<View>("stream");
  const [artifacts, setArtifacts] = useState<Artifact[]>(seedArtifacts);
  const [formOpen, setFormOpen] = useState(false);
  const [formDraft, setFormDraft] = useState<AppraisalFormDraft | null>(null);
  const [resonanceHandoff, setResonanceHandoff] = useState<{ thought: string; title: string; key: number; isPublic: boolean; allowModel: boolean } | null>(null);
  const [selected, setSelected] = useState<Artifact | null>(null);
  const [arrivalId, setArrivalId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareIssue, setShareIssue] = useState("");
  const [copied, setCopied] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveInitialId, setArchiveInitialId] = useState<string | null>(null);
  const [privateCount, setPrivateCount] = useState(0);
  const [privateToast, setPrivateToast] = useState<Artifact | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const refreshVersion = useRef(0);
  const catalogEtag = useRef<string | null>(null);
  const catalog = useMemo(() => createExhibitionCatalog(artifacts), [artifacts]);
  const sampleCount = catalog.filter(item => isExhibitionSample(item.id)).length;

  useEffect(() => {
    try { setArrivalId(sessionStorage.getItem(LAST_PUBLIC_ARRIVAL)); }
    catch { /* In-memory tracking still works when browser storage is disabled. */ }
  }, []);

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    try {
      const response = await fetch("/api/artifacts", {
        cache: "no-store",
        headers: catalogEtag.current ? { "If-None-Match": catalogEtag.current } : undefined,
      });
      if (response.status === 304) return;
      if (!response.ok) return;
      const data = await response.json();
      if (version === refreshVersion.current && Array.isArray(data.artifacts)) {
        catalogEtag.current = response.headers.get("ETag");
        setArtifacts(data.artifacts);
      }
    } catch { /* retain the last visible exhibition */ }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [refresh, view]);

  useEffect(() => {
    let active = true;
    const refreshCount = () => {
      void listPersonalArtifacts().then((records) => { if (active) setPrivateCount(records.length); }).catch(() => { /* The drawer explains storage errors when opened. */ });
    };
    const visible = () => { if (document.visibilityState === "visible") refreshCount(); };
    refreshCount();
    window.addEventListener(PRIVATE_ARCHIVE_CHANGED, refreshCount);
    window.addEventListener("pageshow", refreshCount);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      window.removeEventListener(PRIVATE_ARCHIVE_CHANGED, refreshCount);
      window.removeEventListener("pageshow", refreshCount);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  useEffect(() => {
    if (!privateToast) return;
    const timeout = window.setTimeout(() => setPrivateToast(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [privateToast]);

  useEffect(() => {
    if (!shareOpen) return;
    setCopied(false);
    setShareUrl("");
    setShareIssue("");
    const configuredUrl = process.env.NEXT_PUBLIC_PUBLIC_URL?.trim();
    if (configuredUrl) {
      try {
        const url = new URL(configuredUrl);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid protocol");
        if (!isLoopbackHost(url.hostname)) {
          setShareUrl(url.href);
          return;
        }
        // Loopback addresses point to the phone itself; detect the computer's LAN IP instead.
      } catch {
        setShareIssue("NEXT_PUBLIC_PUBLIC_URL 地址无效，请填写完整的 http:// 或 https:// 地址。");
        return;
      }
    }

    const current = new URL(window.location.href);
    if (!isLoopbackHost(current.hostname)) {
      setShareUrl(current.origin);
      return;
    }

    let active = true;
    fetch("/api/share-address", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Could not detect a local network address");
        return response.json() as Promise<{ address: string | null }>;
      })
      .then(({ address }) => {
        if (!active) return;
        if (address) setShareUrl(`http://${address}${current.port ? `:${current.port}` : ""}`);
        else setShareIssue("未找到可用的局域网地址。请连接 Wi-Fi，或在 .env.local 配置 NEXT_PUBLIC_PUBLIC_URL。");
      })
      .catch(() => {
        if (active) setShareIssue("无法生成手机入口。请检查电脑的网络连接后刷新页面。");
      });
    return () => { active = false; };
  }, [shareOpen]);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  useEffect(() => { if (selected) detailRef.current?.scrollTo({ top: 0 }); }, [selected?.id]);

  function onCreated(artifact: Artifact) {
    ++refreshVersion.current;
    catalogEtag.current = null;
    setArtifacts((previous) => [artifact, ...previous.filter((item) => item.id !== artifact.id)]);
    setArrivalId(artifact.id);
    try { sessionStorage.setItem(LAST_PUBLIC_ARRIVAL, artifact.id); }
    catch { /* Keep this tab's in-memory star available. */ }
    setFormDraft(null);
    setResonanceHandoff(null);
  }

  function onArchived(artifact: Artifact) {
    if (!artifact.isPublic) {
      setArrivalId(null);
      try { sessionStorage.removeItem(LAST_PUBLIC_ARRIVAL); } catch { /* Private records stay off the public graph. */ }
    }
    setPrivateToast(artifact);
    setFormDraft(null);
    setResonanceHandoff(null);
    void listPersonalArtifacts().then((records) => setPrivateCount(records.length)).catch(() => {});
  }

  function exploreResonance(draft: AppraisalFormDraft) {
    setFormDraft(draft);
    setResonanceHandoff({ thought: draft.desc, title: draft.title, key: Date.now(), isPublic: draft.isPublic, allowModel: draft.isPublic && draft.allowResonanceModel });
    setFormOpen(false);
    setView("ancient");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  }

  function openPrivateArchive(initialId: string | null = null) {
    setArchiveInitialId(initialId);
    setPrivateToast(null);
    setArchiveOpen(true);
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); }
    catch { setCopied(false); }
  }

  const detailLinks = selected ? strongestConnections(createExperienceLinks(catalog), selected.id) : [];
  const related = detailLinks.flatMap(link => {
    const artifact = catalog.find(item => item.id === (link.from === selected?.id ? link.to : link.from));
    return artifact ? [{ artifact, reason: link.label }] : [];
  });

  return (
    <main className={`museum-app ${selected ? "is-reading" : ""}`}>
      <header className="topbar">
        <button type="button" className="brand" onClick={() => setView("stream")} aria-label="返回无意义博物馆漂流展厅">
          <span className="brand-symbol">◯</span><span>无意义博物馆</span><small>MOM</small>
        </button>
        <nav className="primary-nav" aria-label="展厅模式">
          <button type="button" className={view === "stream" ? "active" : ""} onClick={() => setView("stream")}>漂流展厅</button>
          <button type="button" className={view === "constellation" ? "active" : ""} onClick={() => setView("constellation")}>小事星图</button>
          <button type="button" className={view === "ancient" ? "active" : ""} onClick={() => setView("ancient")}>与先贤共振</button>
        </nav>
        <div className="topbar-actions">
          <span className="site-label">无意义常设展</span>
          <button type="button" className="outline-button desktop-share" onClick={() => setShareOpen(true)}>邀请入馆</button>
          <button type="button" className="private-archive-trigger mobile-archive-entry" onClick={() => openPrivateArchive()} aria-label={`我的深库，${privateCount} 件提交记录`} title="我的深库">▤</button>
          <button type="button" className="header-cta" onClick={() => setFormOpen(true)}>提交小事 <span>↗</span></button>
        </div>
      </header>

      <div className="mode-tabs-mobile" role="tablist" aria-label="展厅模式">
        <button role="tab" aria-selected={view === "stream"} className={view === "stream" ? "active" : ""} onClick={() => setView("stream")}>漂流展厅</button>
        <button role="tab" aria-selected={view === "constellation"} className={view === "constellation" ? "active" : ""} onClick={() => setView("constellation")}>小事星图</button>
        <button role="tab" aria-selected={view === "ancient"} className={view === "ancient" ? "active" : ""} onClick={() => setView("ancient")}>与先贤共振</button>
      </div>

      {view === "stream"
        ? <ArtifactStreamHero artifacts={catalog} onOpen={setSelected} onSubmit={() => setFormOpen(true)} paused={Boolean(selected || formOpen || archiveOpen || shareOpen)} />
        : view === "constellation"
          ? <VoidConstellation artifacts={catalog} onOpen={setSelected} arrivalId={arrivalId} playbackReady={!formOpen} />
          : <AncientResonance handoff={resonanceHandoff} onReturnToDraft={formDraft ? () => setFormOpen(true) : undefined} />}

      <footer className="museum-footer">
        <div><span className="live-dot" /> <strong>展厅开放中</strong><span className="footer-divider">/</span>在展投稿 {catalog.length - sampleCount} 件 <span className="sample-note">· 展陈样本 {sampleCount} 件 · 两页共用展陈</span></div>
        <div className="footer-right"><span>每一件无用之物，都有独立的编号。</span><button type="button" className="private-archive-trigger footer-archive-entry" onClick={() => openPrivateArchive()}>▤ 我的深库 {privateCount > 0 ? `· ${privateCount}` : ""}</button><button type="button" onClick={() => setShareOpen(true)}>分享入口 ↗</button></div>
      </footer>

      {formOpen && <AppraisalModal onClose={() => setFormOpen(false)} onCreated={onCreated} onArchived={onArchived} onOpenPrivateArchive={(id) => openPrivateArchive(id)} initialDraft={formDraft} onExploreResonance={exploreResonance} />}
      {privateToast && !archiveOpen && <div className="private-archive-toast" role="status"><span>{privateToast.isPublic ? "公开记录已在本机深库留存" : "已收入本机深库"}</span><button type="button" onClick={() => openPrivateArchive(privateToast.id)}>查看 ↗</button></div>}
      {archiveOpen && <PrivateArchiveDrawer initialId={archiveInitialId} onClose={() => setArchiveOpen(false)} />}
      {selected && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <article className="detail-modal" role="dialog" aria-modal="true" aria-label={`${selected.title}馆藏详情`} ref={detailRef}>
            <div className="modal-top"><span>ARCHIVE / {displayArtifactId(selected.id)}</span><button type="button" onClick={() => setSelected(null)} aria-label="关闭馆藏详情">×</button></div>
            {selected.imageUrl && <img className="detail-image" src={selected.imageUrl} alt={isExhibitionSample(selected.id) ? "馆藏展陈配图" : "投稿者提供的馆藏照片"} />}
            <p className="form-kicker">{selected.tag} / {selected.date} {isExhibitionSample(selected.id) ? "· 展陈样本" : "· 公开投稿"}</p>
            <h2>{selected.title}</h2>
            <blockquote>“{selected.desc}”</blockquote>
            <div className="detail-rule" />
            <p className="detail-section-title">公开的鉴定推导</p>
            <ol>{selected.cot.map((step, index) => <li key={index}><span>0{index + 1}</span>{step}</li>)}</ol>
            <p className="detail-conclusion">{selected.appraisalConclusion}</p>
            {related.length > 0 && <section className="detail-related" aria-label="相似的小事">
              <p className="detail-section-title">另一些相似的小事</p>
              <p>原话里的动作与结果，让这些小事产生了联系。</p>
              <div>{related.map(({ artifact, reason }) => <button type="button" key={artifact.id} onClick={() => setSelected(artifact)}><span>{reason} · {artifact.date}</span><strong>{artifact.title}</strong><small>“{artifact.desc}”</small><b aria-hidden="true">↗</b></button>)}</div>
            </section>}
          </article>
        </div>
      )}
      {shareOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareOpen(false); }}>
          <div className="share-modal" role="dialog" aria-modal="true" aria-label="邀请入馆">
            <div className="modal-top"><span>INVITE / MOM</span><button type="button" onClick={() => setShareOpen(false)} aria-label="关闭分享窗口">×</button></div>
            <h2>邀请一件小事入馆</h2>
            <p>手机与电脑连接同一 Wi-Fi 后，扫码进入展厅。</p>
            {shareUrl && <div className="qr-frame"><QRCodeSVG value={shareUrl} size={168} bgColor="#f4f1ea" fgColor="#171416" marginSize={1} /></div>}
            <div className="share-link">{shareUrl || shareIssue || "正在查找手机可访问的地址…"}</div>
            <button type="button" className="submit-cta" onClick={copyLink} disabled={!shareUrl}>{copied ? "已复制入口链接" : "复制入口链接"}<span>↗</span></button>
          </div>
        </div>
      )}
    </main>
  );
}
