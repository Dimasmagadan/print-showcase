import { readHomeReturn, type HomeReturn } from './internal-history';
import { HOME_MOTION } from './home-motion-state';

const scene = document.querySelector<HTMLElement>('[data-home-motion]');
const cards = [...document.querySelectorAll<HTMLAnchorElement>('.model-card[data-model-id]')];
let keyboard = false;
addEventListener('keydown', () => { keyboard = true; }, { passive: true });
addEventListener('pointerdown', () => { keyboard = false; }, { passive: true });

document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-model-id]');
  if (!link || link.target || link.hasAttribute('download')) return;
  const card = cards.find(card => card.dataset.modelId === link.dataset.modelId);
  if (!card) return;
  const state: HomeReturn = {
    version: 1, model: link.dataset.modelId!,
    source: link.dataset.motionSource === 'hero' ? 'hero' : 'catalog',
    motion: document.documentElement.classList.contains('home-motion'),
    offset: card.getBoundingClientRect().top,
    progress: Number(scene?.dataset.progress ?? 0), keyboard,
  };
  try { history.replaceState({ ...history.state, homeReturn: state }, ''); }
  catch { /* Ordinary navigation remains available when state cannot be saved. */ }
});

addEventListener('pageshow', event => {
  if (location.hash || (!event.persisted &&
      (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type !== 'back_forward')) return;
  let state: HomeReturn | null;
  try { state = readHomeReturn(history.state?.homeReturn); }
  catch { return; }
  if (!state) return;
  const card = cards.find(card => card.dataset.modelId === state.model);
  if (!card) return;

  const pending = new Set<number>();
  const input = new AbortController();
  let observer: MutationObserver | undefined;
  let cancelled = false;
  const cleanup = () => {
    observer?.disconnect();
    input.abort();
    document.documentElement.removeAttribute('data-home-restoring');
  };
  const cancel = () => {
    cancelled = true;
    pending.forEach(cancelAnimationFrame);
    pending.clear();
    cleanup();
  };
  // Cancel both an outstanding media wait and already queued scroll/focus.
  // Native restoration and our own scrollTo may emit scroll, so wheel,
  // touch, pointer and keyboard identify new user actions without confusing
  // them with browser restoration.
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'focusin', 'pagehide']) {
    addEventListener(type, cancel, { passive: true, signal: input.signal });
  }
  const queue = (callback: () => void) => {
    const id = requestAnimationFrame(() => {
      pending.delete(id);
      if (!cancelled) callback();
    });
    pending.add(id);
  };
  const focus = (target: HTMLAnchorElement) => {
    if (!state.keyboard) { cleanup(); return; }
    queue(() => {
      target.setAttribute('data-restored-focus', '');
      target.addEventListener('blur', () => target.removeAttribute('data-restored-focus'), { once: true });
      target.focus({ preventScroll: true });
      cleanup();
    });
  };
  if (event.persisted) {
    // Preserve the cached position unless a saved hero disappeared when the
    // home controller rechecked mode in its own pageshow handler.
    queue(() => {
      if (state.source !== 'hero' || !state.motion ||
          document.documentElement.classList.contains('home-motion')) { cleanup(); return; }
      card.scrollIntoView({ block: 'start', behavior: 'instant' });
      focus(card);
    });
    return;
  }
  const restore = () => {
    const motion = document.documentElement.classList.contains('home-motion');
    let target = card;
    if (state.source === 'hero' && motion && scene) {
      const stage = scene.querySelector<HTMLElement>('[data-stage]')!;
      scrollTo(0, scene.offsetTop + stage.clientHeight * HOME_MOTION.scrollScreens * state.progress);
      target = scene.querySelector<HTMLAnchorElement>('.story-link') ?? card;
    } else {
      scrollBy(0, card.getBoundingClientRect().top - (state.source === 'hero' ? 96 : state.offset));
    }
    focus(target);
  };
  // New documents restore compatible geometry; cached DOM owns its position.
  const ready = () => !document.documentElement.classList.contains('home-motion') || scene?.hasAttribute('data-ready');
  if (ready()) queue(restore);
  else {
    observer = new MutationObserver(() => {
      if (!ready()) return;
      observer?.disconnect();
      queue(restore);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    if (scene) observer.observe(scene, { attributes: true, attributeFilter: ['data-ready'] });
  }
});
