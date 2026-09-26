type Particle = { x: number; y: number; dx: number; dy: number; size: number; duration: number; warm: boolean };

// Dust starts inside the rendered glyph strokes rather than across a rectangle.
export function burstTitleParticles(scene: HTMLElement, characters: HTMLElement[], canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext("2d");
  if (!context || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const bounds = scene.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.ceil(bounds.width * ratio);
  canvas.height = Math.ceil(bounds.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const candidates: Particle[] = [];
  const mobile = bounds.width < 760;
  for (const character of characters) {
    const rect = character.getBoundingClientRect();
    const style = getComputedStyle(character);
    const mask = document.createElement("canvas");
    mask.width = Math.ceil(rect.width);
    mask.height = Math.ceil(rect.height);
    const ink = mask.getContext("2d", { willReadFrequently: true });
    if (!ink || !mask.width || !mask.height) continue;
    ink.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ink.textAlign = "center";
    ink.textBaseline = "middle";
    ink.fillText(character.textContent || "", mask.width / 2, mask.height / 2);
    const pixels = ink.getImageData(0, 0, mask.width, mask.height).data;
    const stride = mobile ? 2 : 3;
    for (let y = 0; y < mask.height; y += stride) for (let x = 0; x < mask.width; x += stride) {
      if (pixels[(y * mask.width + x) * 4 + 3] < 100) continue;
      const angle = Math.atan2(y - mask.height / 2, x - mask.width / 2) + (Math.random() - .5) * 1.5;
      const distance = (mobile ? 140 : 210) + Math.random() * (mobile ? 180 : 240);
      candidates.push({ x: rect.left - bounds.left + x, y: rect.top - bounds.top + y,
        dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance,
        size: .8 + Math.random() * 1.8, duration: 1400 + Math.random() * 750, warm: Math.random() < .12 });
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const particles = candidates.slice(0, mobile ? 650 : 1100);
  let frame = 0;
  let stopped = false;
  const start = performance.now();
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", stop);
    context.clearRect(0, 0, bounds.width, bounds.height);
  };
  const paint = (now: number) => {
    if (stopped) return;
    context.clearRect(0, 0, bounds.width, bounds.height);
    if (document.hidden || now - start > 2200) { stop(); return; }
    for (const particle of particles) {
      const progress = Math.min(1, (now - start) / particle.duration);
      const travel = 1 - Math.pow(1 - progress, 3);
      context.globalAlpha = Math.pow(1 - progress, 1.4) * .9;
      context.fillStyle = particle.warm ? "#e6c17d" : "#f0eae0";
      const size = particle.size * (1 - progress * .5);
      context.fillRect(particle.x + particle.dx * travel, particle.y + particle.dy * travel, size, size);
    }
    frame = requestAnimationFrame(paint);
  };
  window.addEventListener("resize", stop, { passive: true });
  paint(start);
  return stop;
}
