import { readSequence, storyProgress, storyState, type Sequence } from './robot-cat-story-state.ts';

type Plan = { urls: string[]; ready: () => void; error: () => void };
type Bitmap = { width: number; height: number; close: () => void };
type Job = { owner: string; epoch: number; abort: AbortController };
type FrameIO = { fetch: typeof fetch; decode: (blob: Blob) => Promise<Bitmap>; controller: () => AbortController };

/** Shared by both chapters. Reservations bound cached + decoding bitmaps to eight. */
export class StoryFramePool {
  cache = new Map<string, Bitmap>();
  plans = new Map<string, Plan>();
  pending = new Map<string, Job>();
  epoch = 0;
  reservations = 0;
  private io: FrameIO;
  constructor(io: FrameIO) { this.io = io; }

  get(url: string) {
    const bitmap = this.cache.get(url);
    if (bitmap) { this.cache.delete(url); this.cache.set(url, bitmap); }
    return bitmap;
  }
  plan(owner: string, urls: string[], ready: () => void, error: () => void) {
    this.plans.set(owner, { urls, ready, error });
    this.pump();
  }
  trim(limit: number) {
    while (this.cache.size > Math.max(0, limit)) {
      const key = this.cache.keys().next().value!;
      this.cache.get(key)!.close();
      this.cache.delete(key);
    }
  }
  remove(owner: string) {
    const plan = this.plans.get(owner);
    this.plans.delete(owner);
    for (const [url, job] of this.pending) if (job.owner === owner) job.abort.abort();
    if (plan) for (const url of plan.urls) {
      this.cache.get(url)?.close();
      this.cache.delete(url);
    }
  }
  clear() {
    this.epoch++;
    this.plans.clear();
    for (const job of this.pending.values()) job.abort.abort();
    this.trim(0);
    // Jobs remain counted until their fetch/decode actually settles.
  }
  pump() {
    const candidates = [...this.plans].flatMap(([owner, plan]) => plan.urls.map((url, priority) => ({ owner, url, priority })));
    candidates.sort((a, b) => a.priority - b.priority);
    // Two nearby chapters may ask for ten frames: retain the eight most useful
    // instead of endlessly evicting and reloading one another's prefetches.
    for (const { owner, url } of candidates.slice(0, 8)) {
      if (this.pending.size >= 3) break;
      if (this.cache.has(url) || this.pending.has(url)) continue;
      const job = { owner, epoch: this.epoch, abort: this.io.controller() };
      this.pending.set(url, job);
      void this.load(url, job);
    }
  }
  async load(url: string, job: Job) {
    let reserved = false;
    let bitmap: Bitmap | undefined;
    const valid = () => job.epoch === this.epoch && !job.abort.signal.aborted && this.plans.get(job.owner)?.urls.includes(url);
    try {
      const response = await this.io.fetch(url, { signal: job.abort.signal });
      if (!response.ok) throw Error('Frame unavailable');
      const blob = await response.blob();
      if (!valid()) return;
      this.reservations++;
      reserved = true;
      this.trim(8 - this.reservations);
      bitmap = await this.io.decode(blob);
      if (!valid()) return;
      if (bitmap.width !== 800 || bitmap.height !== 1000) throw Error('Invalid frame size');
      this.reservations--;
      reserved = false;
      this.trim(7 - this.reservations);
      this.cache.set(url, bitmap);
      bitmap = undefined;
      this.plans.get(job.owner)?.ready();
    } catch {
      if (job.epoch === this.epoch && !job.abort.signal.aborted) this.plans.get(job.owner)?.error();
    } finally {
      bitmap?.close();
      if (reserved) this.reservations--;
      this.pending.delete(url);
      this.pump();
    }
  }
}

/** Invoked only after the route finds a root; no work at module evaluation. */
export function initRobotCatStory(root: HTMLElement | null, env: Window & typeof globalThis = window) {
  if (!root) return;
  const choices = root.querySelector<HTMLElement>('.story-choices');
  const posters = [...root.querySelectorAll<HTMLElement>('[data-poster]')];
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-variant]')];
  // Comparison is independent of scroll, reduced motion and frame failures.
  if (choices && posters.length === 2 && buttons.length === 2) {
    const images = posters.map(p => p.querySelector('img'));
    if (images.every(image => image && typeof image.decode === 'function')) {
      void Promise.all(images.map(image => image!.decode())).then(() => {
        if (!images.every(image => image!.naturalWidth > 0)) return;
        const select = (variant: string) => {
          for (const poster of posters) poster.hidden = poster.dataset.poster !== variant;
          for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.variant === variant));
        };
        for (const button of buttons) button.addEventListener('click', () => select(button.dataset.variant!));
        select('cat');
        posters[0].parentElement!.setAttribute('data-ready', '');
        choices.hidden = false;
      }).catch(() => {});
    }
  }

  const chapters = [...root.querySelectorAll<HTMLElement>('[data-sequence]')].map(element => ({
    element, sequence: element.dataset.sequence as Sequence,
    wrapper: element.querySelector<HTMLElement>('.story-visual-wrapper')!,
    visual: element.querySelector<HTMLElement>('.story-visual')!,
    canvas: element.querySelector<HTMLCanvasElement>('canvas')!,
    frames: null as string[] | null, loading: false, failed: false, last: -1, direction: 1,
  }));
  if (!chapters.length || chapters.some(c => !c.wrapper || !c.visual || !c.canvas)) return;
  const supported = typeof env.fetch === 'function' && typeof env.createImageBitmap === 'function' &&
    typeof env.AbortController === 'function' && typeof env.requestAnimationFrame === 'function' &&
    typeof env.matchMedia === 'function';
  if (!supported) return;
  const media = env.matchMedia('(prefers-reduced-motion: reduce)');
  if (typeof media.addEventListener !== 'function') return;
  const pool = new StoryFramePool({ fetch: env.fetch.bind(env), decode: env.createImageBitmap.bind(env), controller: () => new env.AbortController() });
  let enabled = false, hidden = false, raf = 0, epoch = 0;
  let manifest: Promise<any> | null = null;
  let manifestAbort: AbortController | null = null;
  const manifestURL = new URL(root.dataset.manifest!, env.location.href);
  const fail = (chapter: typeof chapters[number]) => {
    chapter.failed = true;
    chapter.canvas.hidden = true;
    delete chapter.canvas.dataset.frame;
    pool.remove(chapter.sequence);
  };
  const invalidate = () => {
    if (enabled && !raf) raf = env.requestAnimationFrame(draw);
  };
  const prepare = async (chapter: typeof chapters[number]) => {
    if (chapter.loading || chapter.frames || chapter.failed) return;
    chapter.loading = true;
    const generation = epoch;
    try {
      if (!manifest) {
        manifestAbort = new env.AbortController();
        manifest = env.fetch(manifestURL.href, { signal: manifestAbort.signal }).then(response => {
          if (!response.ok) throw Error('Manifest unavailable');
          return response.json();
        });
      }
      const data = await manifest;
      if (!enabled || generation !== epoch) return;
      chapter.frames = readSequence(data, chapter.sequence).map(path => new URL(path, manifestURL).href);
      invalidate();
    } catch {
      if (enabled && generation === epoch) fail(chapter);
    } finally {
      if (generation === epoch) chapter.loading = false;
    }
  };
  function draw() {
    raf = 0;
    if (!enabled) return;
    for (const chapter of chapters) {
      if (chapter.failed) continue;
      const rect = chapter.wrapper.getBoundingClientRect();
      // Start about one viewport before the chapter; no eager second sequence.
      if (rect.top > env.innerHeight * 2 || rect.bottom < -env.innerHeight) {
        pool.remove(chapter.sequence);
        continue;
      }
      if (!chapter.frames) { void prepare(chapter); continue; }
      const top = parseFloat(env.getComputedStyle(chapter.visual).top) || 0;
      const progress = storyProgress(env.scrollY, rect.top + env.scrollY, rect.bottom + env.scrollY, top, chapter.visual.getBoundingClientRect().height);
      const frame = storyState(chapter.sequence, progress, chapter.frames.length).frame;
      if (frame !== chapter.last) chapter.direction = frame >= chapter.last ? 1 : -1;
      const direction = chapter.direction;
      const indexes = [frame, frame + direction, frame - direction, frame + 2 * direction, frame - 2 * direction]
        .filter(i => i >= 0 && i < chapter.frames!.length);
      chapter.last = frame;
      const url = chapter.frames[frame];
      const bitmap = pool.get(url);
      if (bitmap && chapter.canvas.dataset.frame !== String(frame)) {
        const context = chapter.canvas.getContext('2d');
        if (!context) { fail(chapter); continue; }
        context.drawImage(bitmap as ImageBitmap, 0, 0);
        chapter.canvas.dataset.frame = String(frame);
        chapter.canvas.hidden = false;
      }
      pool.plan(chapter.sequence, indexes.map(i => chapter.frames![i]), invalidate, () => fail(chapter));
    }
  }
  function disable() {
    enabled = false;
    epoch++;
    if (raf) env.cancelAnimationFrame(raf);
    raf = 0;
    manifestAbort?.abort();
    manifest = null;
    pool.clear();
    for (const chapter of chapters) {
      chapter.loading = false;
      chapter.canvas.hidden = true;
      delete chapter.canvas.dataset.frame;
      chapter.last = -1;
    }
  }
  function configure() {
    const mode = !hidden && !media.matches && env.getComputedStyle(root).getPropertyValue('--story-motion').trim() === '1';
    if (!mode) { if (enabled) disable(); return; }
    enabled = true;
    invalidate();
  }
  const onHide = () => { hidden = true; disable(); };
  const onShow = () => { hidden = false; configure(); };
  env.addEventListener('scroll', invalidate, { passive: true });
  env.addEventListener('resize', configure, { passive: true });
  env.addEventListener('pagehide', onHide);
  env.addEventListener('pageshow', onShow);
  media.addEventListener('change', configure);
  const observer = typeof env.ResizeObserver === 'function' ? new env.ResizeObserver(invalidate) : null;
  chapters.forEach(c => observer?.observe(c.wrapper));
  configure();
  return { pool, dispose() {
    disable();
    observer?.disconnect();
    env.removeEventListener('scroll', invalidate);
    env.removeEventListener('resize', configure);
    env.removeEventListener('pagehide', onHide);
    env.removeEventListener('pageshow', onShow);
    media.removeEventListener('change', configure);
  } };
}
