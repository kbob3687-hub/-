"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { exportTicket } from "@/lib/export-ticket";
import type { Artifact } from "@/lib/artifact";
import { importPrivateArchive, listPersonalArtifacts, savePersonalArtifact, PRIVATE_ARCHIVE_CHANGED } from "@/lib/private-archive";
import ArchivalTicket from "@/components/ArchivalTicket";
import ReceiptPreview from "@/components/ReceiptPreview";

type Props = { onClose: () => void; initialId?: string | null };

export default function PrivateArchiveDrawer({ onClose, initialId }: Props) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialId || null);
  const [mobileDetail, setMobileDetail] = useState(Boolean(initialId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [exportUrl, setExportUrl] = useState("");
  const [reflection, setReflection] = useState("");
  const [savingReflection, setSavingReflection] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);
  const [backupStatus, setBackupStatus] = useState("");
  const ticketRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const exportRef = useRef(exportUrl);
  onCloseRef.current = onClose;
  exportRef.current = exportUrl;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (exportRef.current) setExportUrl("");
      else onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = priorOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    void listPersonalArtifacts()
      .then((records) => {
        if (!active) return;
        setArtifacts(records);
        setSelectedId((prior) => records.some((record) => record.id === prior) ? prior : records[0]?.id || null);
        setLoading(false);
      })
      .catch((reason) => {
        if (!active) return;
        setLoadError(reason instanceof Error ? reason.message : "本机深库暂时无法读取。");
        setLoading(false);
      });
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    const refresh = () => setReload((prior) => prior + 1);
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener(PRIVATE_ARCHIVE_CHANGED, refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener(PRIVATE_ARCHIVE_CHANGED, refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  const selected = artifacts.find((artifact) => artifact.id === selectedId) || null;

  useEffect(() => {
    setReflection(selected?.reflection || "");
  }, [selected?.id, selected?.reflection]);

  async function saveReflection() {
    if (!selected || savingReflection) return;
    setError("");
    setSavingReflection(true);
    try {
      const updated = { ...selected, reflection: reflection.trim() };
      await savePersonalArtifact(updated);
      setArtifacts((previous) => previous.map((artifact) => artifact.id === updated.id ? updated : artifact));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "补记保存失败，请重试。");
    } finally {
      setSavingReflection(false);
    }
  }

  function exportBackup() {
    if (artifacts.length === 0) return;
    const payload = { format: "mom-private-archive", version: 1, exportedAt: new Date().toISOString(), artifacts };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `无意义博物馆-深库备份-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setBackupStatus(`已导出 ${artifacts.length} 件本机档案。备份文件包含原话和照片，请妥善保管。`);
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setBackupStatus("");
    if (file.size > 12_000_000) { setError("备份文件超过 12 MB，请检查文件。"); return; }
    try {
      const count = await importPrivateArchive(JSON.parse(await file.text()));
      const records = await listPersonalArtifacts();
      setArtifacts(records);
      setSelectedId((previous) => previous && records.some((item) => item.id === previous) ? previous : records[0]?.id || null);
      setBackupStatus(count > 0 ? `已找回 ${count} 件本机档案。` : "备份中的馆藏都已在深库中。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法读取备份文件。");
    }
  }

  async function download() {
    if (!ticketRef.current || !selected) return;
    setError("");
    try {
      setExportUrl(await exportTicket(ticketRef.current));
    } catch {
      setError("凭证图片导出失败。请截图保存。");
    }
  }

  return (
    <div className="archive-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="private-archive-drawer" role="dialog" aria-modal="true" aria-label="我的深库">
        <div className="archive-drawer-top"><span>DEEP STORAGE / PERSONAL ARCHIVE</span><button type="button" ref={closeRef} onClick={onClose} aria-label="关闭我的深库">×</button></div>
        <div className="archive-drawer-heading"><div><p className="form-kicker">仅属于此设备的小型档案室</p><h2>我的深库</h2></div><strong>{artifacts.length.toString().padStart(2, "0")} <small>件</small></strong></div>
        <p className="archive-privacy">这里保留你在本浏览器提交的历史。公开记录仍在公共展厅；私密记录仅存本机。请从提交时的同一入口地址查看，清理浏览器数据后可能无法找回，请先导出完整备份；备份包含原话和照片。</p>
        <div className="archive-tools"><button type="button" onClick={exportBackup} disabled={artifacts.length === 0}>导出全部备份 ↓</button><button type="button" onClick={() => importRef.current?.click()}>从备份找回</button><input ref={importRef} className="sr-only" type="file" accept="application/json,.json" aria-label="选择深库备份文件" onChange={(event) => void importBackup(event)} /></div>
        {backupStatus && <p className="archive-backup-status" role="status">{backupStatus}</p>}
        {error && <p className="archive-error" role="alert">{error}</p>}
        {loading ? <div className="archive-empty">正在打开本机档案柜……</div> : loadError ? <div className="archive-empty" role="alert"><h3>档案柜暂时打不开</h3><p>{loadError}</p><button type="button" className="archive-download" onClick={() => setReload((prior) => prior + 1)}>重新读取</button></div> : artifacts.length === 0 ? <div className="archive-empty"><span aria-hidden="true">▤</span><h3>深库还是空的</h3><p>公开或私密提交的小事，都会在这里保留一份历史。<br />旧版的公开提交未保留本机历史，可在公共展厅查看。</p><button type="button" className="archive-download" onClick={() => setReload((prior) => prior + 1)}>刷新档案</button></div> : (
          <div className={`archive-content ${mobileDetail ? "show-detail" : ""}`}>
            <div className="archive-list" aria-label="我的提交历史">
              <p className="archive-list-title">按入库时间排列 / NEWEST FIRST</p>
              {artifacts.map((artifact, index) => (
                <button type="button" key={artifact.id} className={selected?.id === artifact.id ? "active" : ""} onClick={() => { setSelectedId(artifact.id); setMobileDetail(true); setError(""); }}>
                  <span className="archive-list-number">{String(artifacts.length - index).padStart(2, "0")} / {artifact.isPublic ? "公开 · 本机副本" : "私密 · 仅本机"}</span>
                  <strong>{artifact.title}</strong>
                  <span className="archive-list-excerpt">{artifact.desc}</span>
                  <small>{artifact.date} <b>↗</b></small>
                </button>
              ))}
            </div>
            <div className="archive-detail">
              <button type="button" className="archive-mobile-back" onClick={() => setMobileDetail(false)}>← 返回我的深库</button>
              {selected && <>
                <div className="archive-detail-head"><span>PERSONAL RECORD / {selected.date}</span><span>{selected.isPublic ? "公开记录 · 本机留存" : "私密 · 仅本机可见"}</span></div>
                {selected.imageUrl && <img className="archive-photo" src={selected.imageUrl} alt="这件小事附带的照片" />}
                <div className="archive-ticket-wrap"><ArchivalTicket ref={ticketRef} artifact={selected} source={selected.isPublic ? undefined : "offline"} showOriginal={showOriginal} /></div>
                <label className="ticket-privacy-toggle archive-privacy-toggle"><input type="checkbox" checked={!showOriginal} onChange={(event) => setShowOriginal(!event.target.checked)} /> 分享凭证时隐藏我的原话</label>
                <div className="archive-reflection"><p className="form-kicker">再看这件小事</p><h3>{Math.floor((Date.now() - Date.parse(selected.createdAt)) / 86_400_000) >= 30 ? "过了一段时间，现在怎么看它？" : "如果今天再看，你会补上一句话吗？"}</h3><textarea value={reflection} maxLength={500} onChange={(event) => setReflection(event.target.value)} placeholder="这句话只保存在本机深库。" /><div><span>{reflection.length} / 500</span><button type="button" onClick={() => void saveReflection()} disabled={savingReflection || reflection.trim() === (selected.reflection || "")}>{savingReflection ? "保存中…" : reflection.trim() === (selected.reflection || "") ? "已保存" : "保存补记"}</button></div>{selected.reflection && <p>上次补记已留在这件馆藏里。</p>}</div>
                <button type="button" className="archive-download" onClick={download}>↓ 再次保存这张凭证</button>
              </>}
            </div>
          </div>
        )}
      </aside>
      {exportUrl && <ReceiptPreview url={exportUrl} fileName={`${selected?.id.replace(/[^\w-]/g, "-") || "private-receipt"}.png`} onClose={() => setExportUrl("")} />}
    </div>
  );
}
