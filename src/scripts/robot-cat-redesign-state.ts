/** One deterministic timeline. Keyframes are frozen during all reading holds. */
export const clamp = (n: number) => Number.isNaN(n) ? 0 : Math.max(0, Math.min(1, n));
export const holds = [[0, .07], [.11, .20], [.27, .31], [.39, .49], [.59, .65], [.71, .76], [.84, .84], [.90, 1]] as const;
export function redesignState(progress: number, framesPerTransition = 12) {
  const p = clamp(progress);
  let key = 7, next = 7, t = 0;
  for (let k = 0; k < holds.length; k++) {
    const [start, end] = holds[k];
    if (p >= start && p <= end) { key = next = k; break; }
    const following = holds[k + 1]?.[0];
    if (following !== undefined && p > end && p < following) {
      key = k; next = k + 1; t = (p - end) / (following - end); break;
    }
  }
  // Frames contain the eased physical pose; don't ease again in the browser.
  const frame = key * framesPerTransition + Math.round(t * framesPerTransition);
  const held = key === next;
  // K6 copy appears only once the complete incoming head is visible.
  const copy = held ? key : key === 6 && p < .894 ? 6 : null;
  const edge = held ? Math.min((p - holds[key][0]) / .008, (holds[key][1] - p) / .008, 1) : 0;
  const revealOpacity = copy === 6 ? Math.min(clamp((p - .84) / .004), clamp((.894 - p) / .004)) : 0;
  return { key, next, t, frame, copy, opacity: key === 0 && p < .008 || key === 7 && p > .992 ? 1 : held ? clamp(edge) : revealOpacity };
}
export function motionEligible(width: number, height: number, reduced: boolean, rootFont = 16) {
  return width >= 1024 && height >= 700 && !reduced && rootFont <= 20;
}
// Leave room for browser-managed posters and canvas surfaces within the page budget.
export const frameCapacity = (width: number, height: number, budget = 48 * 1024 * 1024) => Math.floor(budget / (width * height * 4));

export function readRedesignManifest(data: any) {
  if (data?.version !== 2 || data.width !== 1600 || data.height !== 1000 || data.framesPerTransition !== 12 ||
      !Array.isArray(data.frames) || data.frames.length !== 85 ||
      !data.frames.every((p: unknown, i: number) => p === `frames/${String(i).padStart(3, '0')}.webp`) ||
      !Array.isArray(data.bytes) || data.bytes.length !== 85 || !data.bytes.every((n: unknown) => Number.isSafeInteger(n) && Number(n) > 0) ||
      data.totalBytes !== data.bytes.reduce((a: number,b: number)=>a+b,0)) throw Error('Invalid redesign manifest');
  return data as {version: 2; width: number; height: number; framesPerTransition: number; frames: string[]; bytes: number[]; totalBytes: number};
}
