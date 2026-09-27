export type GalleryPose = { x: number; y: number; z: number; rx: number; ry: number; rz: number; opacity: number };
export const TUNNEL_SPACING = 460;
export const TUNNEL_NEAR = 290;

export function interpolatePose(from: GalleryPose, to: GalleryPose, progress: number): GalleryPose {
  const mix = (a: number, b: number) => a + (b - a) * progress;
  return { x: mix(from.x, to.x), y: mix(from.y, to.y), z: mix(from.z, to.z), rx: mix(from.rx, to.rx), ry: mix(from.ry, to.ry), rz: mix(from.rz, to.rz), opacity: mix(from.opacity, to.opacity) };
}

export function floatPose(index: number, count: number, width: number, height: number, seconds: number): GalleryPose {
  const lane = index % 3, ordinal = Math.floor(index / 3);
  const laneCount = Math.max(1, Math.ceil((count - lane) / 3));
  const period = [72, 58, 48][lane];
  const travel = ((seconds / period + (ordinal + .45) / laneCount) % 1 + 1) % 1;
  return {
    x: -440 + travel * (width + 880) - width / 2,
    y: height * [-.02, .46, .9][lane] - height / 2 + Math.sin(seconds * .65 + index) * 9,
    z: [-170, -55, 45][lane], rx: index % 2 ? 2 : -2,
    ry: index % 2 ? -4 : 5, rz: index % 2 ? -4 : 4,
    opacity: [.53, .8, .94][lane],
  };
}

export function tunnelPose(index: number, count: number, width: number, height: number, camera: number): GalleryPose {
  const length = Math.max(1, count) * TUNNEL_SPACING;
  // Cylindrical coordinates: x = r cos(theta), y = r sin(theta).
  // Alternating sides plus a slow twist creates a spiral of inward-facing windows.
  const theta = index * Math.PI + Math.sin(index * 1.7) * .7;
  const radius = Math.max(225, Math.min(590, width * .38));
  const verticalRadius = Math.min(height * .32, radius * .65);
  // Wrap one existing DOM card beyond the camera into the distant end.
  // This creates endless travel without cloning any exhibit.
  const z = TUNNEL_NEAR - (((TUNNEL_NEAR + 170 + index * TUNNEL_SPACING - camera) % length + length) % length);
  return {
    x: Math.cos(theta) * radius, y: Math.sin(theta) * verticalRadius,
    z, rx: Math.sin(theta) * 8, ry: -Math.cos(theta) * 17,
    rz: Math.sin(index * 1.3) * 5,
    opacity: z > 120 ? Math.max(.05, 1 - (z - 120) / 180) : Math.min(1, Math.max(.12, 1 + z / (length * 1.2))),
  };
}
