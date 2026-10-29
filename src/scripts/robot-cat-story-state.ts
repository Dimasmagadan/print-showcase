export type Sequence = 'split' | 'swap';
export const clamp = (value: number) => Number.isNaN(value) ? 0 : Math.max(0, Math.min(1, value));
export const ease = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

/** Geometry is the visual wrapper's document bounds, not the chapter heading. */
export function storyProgress(scroll: number, top: number, bottom: number, stickyTop: number, height: number) {
  const start = top - stickyTop;
  const range = Math.max(1, bottom - stickyTop - height - start);
  return clamp((scroll - start) / range);
}

export function storyState(sequence: Sequence, progress: number, count: number) {
  const p = clamp(progress);
  let q: number;
  if (sequence === 'swap') q = ease((p - .18) / .47);
  else if (p <= .15) q = 0;
  else if (p < .32) q = ease((p - .15) / .17);
  else if (p <= .65) q = 1;
  else if (p < .83) q = 1 - ease((p - .65) / .18);
  else q = 0;
  return { sequence, q, frame: Math.round(clamp(q) * Math.max(0, Math.floor(Number.isFinite(count) ? count : 1) - 1)) };
}

export function readSequence(manifest: any, sequence: Sequence): string[] {
  if (manifest?.version !== 1 || manifest.width !== 800 || manifest.height !== 1000 ||
      !Number.isSafeInteger(manifest.totalBytes) || manifest.totalBytes <= 0 ||
      Object.values(manifest.sequences ?? {}).reduce((sum: number, entry: any) => sum + entry.totalBytes, 0) !== manifest.totalBytes) throw Error('Invalid story manifest');
  const entry = manifest.sequences?.[sequence];
  if (!Number.isInteger(entry?.count) || entry.count < 2 || entry.count > 240 ||
      !Array.isArray(entry.frames) || entry.frames.length !== entry.count ||
      !entry.frames.every((path: unknown, i: number) => path === `${sequence}/${String(i).padStart(3, '0')}.webp`) ||
      !Array.isArray(entry.bytes) || entry.bytes.length !== entry.count ||
      !entry.bytes.every((size: unknown) => Number.isSafeInteger(size) && Number(size) > 0) ||
      entry.bytes.reduce((sum: number, size: number) => sum + size, 0) !== entry.totalBytes) throw Error('Invalid sequence');
  return entry.frames;
}
