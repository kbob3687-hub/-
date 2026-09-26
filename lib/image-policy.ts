// Originals stay on the device; only the optimized image enters the archive.
export const MAX_ORIGINAL_IMAGE_BYTES = 30 * 1024 * 1024;
export const MAX_ARCHIVE_IMAGE_BYTES = 1_000_000;
export const MAX_IMAGE_DATA_URL_LENGTH = 1_500_000;

export function isArchiveImage(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_IMAGE_DATA_URL_LENGTH &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
