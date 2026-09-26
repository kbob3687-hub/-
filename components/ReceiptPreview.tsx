"use client";

type Props = { url: string; fileName: string; onClose: () => void };

export default function ReceiptPreview({ url, fileName, onClose }: Props) {
  return (
    <div className="receipt-preview" role="dialog" aria-modal="true" aria-label="保存凭证图片">
      <button type="button" className="preview-close" onClick={onClose} aria-label="关闭凭证预览">×</button>
      <p>长按图片保存，或点击下载后分享给朋友。</p>
      <img src={url} alt="可保存的无意义入藏凭证" />
      <a href={url} download={fileName}>下载 PNG 凭证 ↓</a>
    </div>
  );
}
