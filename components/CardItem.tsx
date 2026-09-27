"use client";

import { isExhibitionSample } from "@/lib/exhibition-catalog";

export interface MuseumCard {
  id: string;
  code: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  date: string;
  type: string;
}

type Props = {
  card: MuseumCard;
  onOpen: (card: MuseumCard) => void;
  conclusion?: string;
};

/** Both modes keep this same DOM button, including its image and archive action. */
export default function CardItem({ card, onOpen, conclusion }: Props) {
  return <button type="button" className={`floating-artifact ${card.imageUrl ? "" : "artifact-text-card"}`} onClick={() => onOpen(card)} aria-label={`查看馆藏 ${card.title}`}>
    <span className="artifact-head"><span className="artifact-index">{card.code}</span><span className="artifact-tag">{card.type}</span></span>
    {card.imageUrl ? <>
      <span className="artifact-media"><img src={card.imageUrl} alt="" loading="lazy" /></span>
      <span className="artifact-summary"><strong className="artifact-title">{card.title}</strong><span className="artifact-excerpt">{card.excerpt}</span></span>
    </> : <span className={`artifact-text-body ${card.excerpt.length > 55 ? "is-long" : card.excerpt.length < 20 ? "is-short" : ""}`}>
      <span className="artifact-text-label">文字标本 / ORIGINAL MOMENT</span>
      <strong className="artifact-original">{card.excerpt}</strong>
      <span className="artifact-text-open">查看档案 ↗</span>
    </span>}
    <span className="artifact-foot"><span>{isExhibitionSample(card.id) ? "展陈样本 / 非用户投稿" : "公开投稿 / 准予封存"}</span><span>{card.date}</span></span>
    <span className="artifact-detail" aria-hidden="true">
      <span className="artifact-detail-label">ARCHIVE / {card.type}</span><strong>{card.title}</strong><span>{card.excerpt}</span>
      {conclusion && <em>{conclusion}</em>}<small>查看完整档案 ↗</small>
    </span>
  </button>;
}
