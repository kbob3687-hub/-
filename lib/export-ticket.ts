import { toPng } from "html-to-image";

export async function exportTicket(element: HTMLElement) {
  // Wait for every photo before cloning the receipt, including data URL uploads.
  await Promise.all(Array.from(element.querySelectorAll("img")).map(async (image) => {
    try { await image.decode(); }
    catch { throw new Error("物证照片尚未加载成功，请稍后再保存凭证。"); }
  }));
  await document.fonts.ready;
  return toPng(element, { pixelRatio: 2, cacheBust: false, backgroundColor: "#f4f1ea" });
}
