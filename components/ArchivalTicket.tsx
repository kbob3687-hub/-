"use client";

import { forwardRef } from "react";
import { Artifact, displayArtifactId } from "@/lib/artifact";

type Props = { artifact: Artifact; source?: "ai" | "offline"; stamped?: boolean; showOriginal?: boolean; preview?: boolean };

const ArchivalTicket = forwardRef<HTMLDivElement, Props>(function ArchivalTicket({ artifact, source, stamped = true, showOriginal = true, preview = false }, ref) {
  return (
    <div className="ticket" ref={ref}>
      <div className="ticket-topline"><span>无意义博物馆</span><span>FORM / MOM-01</span></div>
      <div className="ticket-kicker">MUSEUM OF MEANINGLESSNESS</div>
      <h2>无意义入藏凭证</h2>
      <div className="ticket-divider" />
      <div className="ticket-field"><span>馆藏编号</span><strong>{displayArtifactId(artifact.id)}</strong></div>
      <div className="ticket-field"><span>记录时间</span><strong>{artifact.date}</strong></div>
      <div className="ticket-field"><span>物质类别</span><strong>{artifact.tag}</strong></div>
      <div className="ticket-divider" />
      <div className="ticket-story"><p className="ticket-label">标本定名 / SPECIMEN</p>
        <h3>{artifact.title}</h3>
        <p className="ticket-original">{showOriginal ? `“${artifact.desc}”` : "原话由投稿者选择隐去"}</p>
      </div>
      {artifact.imageUrl && (
        <figure className="ticket-evidence">
          <figcaption>[ 物证影像记录 · 灰度存盘 ]</figcaption>
          <div className="ticket-evidence-frame"><img src={artifact.imageUrl} alt="标本附带的黑白物证影像" loading="eager" decoding="async" /></div>
        </figure>
      )}
      <div className="ticket-divider" />
      <p className="ticket-label">鉴定推导 / APPRAISAL NOTES</p>
      <ol className="ticket-steps">
        {artifact.cot.map((step, index) => <li key={`${index}-${step}`}><span>0{index + 1}</span>{step}</li>)}
      </ol>
      <p className="ticket-conclusion">鉴定结论：{artifact.appraisalConclusion}</p>
      <div className="ticket-bottom">
        <div><small>生产力贡献 · 本馆拟制指标</small><b>{artifact.metrics.gdpContribution}</b></div>
        <div><small>熵增 · 未作科学测量</small><b>{artifact.metrics.entropyIncrease}</b></div>
      </div>
      <div className={`ticket-stamp ${stamped ? "is-stamped" : ""}`} aria-label={preview ? "等待确认入库" : "完全无用，准予永久封存"}>{preview ? <>等待确认<br />入库</> : <>完全无用<br />准予永久封存</>}</div>
      <div className="ticket-footer"><span>{preview ? "鉴定预览 · 尚未入库" : artifact.isPublic ? "公开常设展" : "深库特藏 · 仅存本机"}</span><span>{source === "offline" ? "离线编目" : "MOM ARCHIVE"}</span></div>
    </div>
  );
});

export default ArchivalTicket;
