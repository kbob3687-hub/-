import { MAX_ARCHIVE_IMAGE_BYTES, MAX_ORIGINAL_IMAGE_BYTES, isArchiveImage } from "./image-policy";

function decode(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("无法读取这张照片，请换一张 JPG、PNG 或 WebP 图片。")); };
    image.src = url;
  });
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("照片处理失败，请重新选择。")), "image/jpeg", quality,
  ));
}

export async function prepareImage(file: File): Promise<string> {
  if (file.size > MAX_ORIGINAL_IMAGE_BYTES) throw new Error("照片超过 30 MB，请选择一张稍小的照片。");
  const heic = /\.(heic|heif)$/i.test(file.name) || /image\/(heic|heif)/i.test(file.type);
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name)) {
    throw new Error("请选择一张照片或图片。");
  }
  let image: HTMLImageElement;
  try { image = await decode(file); }
  catch (reason) {
    if (!heic) throw reason;
    try {
      // Load the HEIC decoder only when the browser cannot open an iPhone photo.
      const { default: heic2any } = await import("heic2any");
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      image = await decode(Array.isArray(converted) ? converted[0] : converted);
    } catch { throw new Error("这张 HEIC 照片无法转换，请从相册导出为 JPG 后再试。"); }
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context || !image.naturalWidth || !image.naturalHeight) throw new Error("照片处理失败，请重新选择。");
  let edge = 2048;
  let blob: Blob | undefined;
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.86, 0.76, 0.66]) {
        blob = await encode(canvas, quality);
        if (blob.size <= MAX_ARCHIVE_IMAGE_BYTES) break;
      }
      if (blob && blob.size <= MAX_ARCHIVE_IMAGE_BYTES) break;
      edge = Math.round(edge * 0.75);
    }
    if (!blob || blob.size > MAX_ARCHIVE_IMAGE_BYTES) throw new Error("照片压缩失败，请换一张照片再试。");
    const optimized = blob;
    const result = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("照片读取失败。"));
      reader.onerror = () => reject(new Error("照片读取失败。"));
      reader.readAsDataURL(optimized);
    });
    if (!isArchiveImage(result)) throw new Error("照片处理失败，请重新选择。");
    return result;
  } finally { canvas.width = 0; canvas.height = 0; }
}
