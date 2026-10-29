/** One seekable timeline; all values depend only on scroll position. */
export const HOME_MOTION = {
  minWidth: 1280,
  minHeight: 800,
  scrollScreens: 2,
  timings: { approach: [0.15, 0.45], environment: [0.45, 0.7], caption: [0.6, 0.72] },
} as const;

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const phase = (p: number, a: number, b: number) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function homeMotionState(progress: number) {
  const p = clamp(progress);
  const approach = phase(p, ...HOME_MOTION.timings.approach);
  const environment = phase(p, ...HOME_MOTION.timings.environment);
  const reveal = phase(p, 0.7, 0.84);
  const printerScale = mix(1, 2.55, approach);
  // Until the glass plane, subject and printer share the same camera.
  // At H01 the feet are at 73%, relative to a 59% zoom origin.
  const bedBottom = 100 - (59 + (73 - 59) * printerScale);
  return {
    progress: p,
    // A single photographic subject retains its silhouette throughout.
    catHeight: 27 * printerScale - 1.85 * reveal,
    catX: mix(71.5, 65, environment),
    catBottom: mix(bedBottom, 12, environment),
    printerScale,
    doorDetail: phase(p, 0.25, 0.38),
    printerOpacity: 1 - environment,
    workshopOpacity: environment,
    warmth: 1 - environment,
    reflection: Math.sin(Math.PI * phase(p, 0.43, 0.61)) * 0.22,
    introOpacity: 1 - phase(p, 0.15, 0.25),
    captionOpacity: phase(p, ...HOME_MOTION.timings.caption),
  };
}
