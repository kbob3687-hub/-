// GET uses weak comparison: gzip and uncompressed JSON represent the same catalogue.
export function matchesIfNoneMatch(header: string | null, etag: string): boolean {
  if (!header) return false;
  const normalize = (value: string) => value.replace(/^W\//, "");
  const validators = header.match(/(?:W\/)?"[^"\r\n]*"|\*/g) || [];
  return validators.some(value => value === "*" || normalize(value) === normalize(etag));
}
