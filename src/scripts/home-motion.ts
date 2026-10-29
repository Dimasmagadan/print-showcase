import { HOME_MOTION, homeMotionState } from './home-motion-state';

const root = document.documentElement;
const section = document.querySelector<HTMLElement>('[data-home-motion]');
if (section) initialize(section);

function initialize(section: HTMLElement) {
  const stage = section.querySelector<HTMLElement>('[data-stage]')!;
  const intro = section.querySelector<HTMLElement>('[data-intro]')!;
  const actions = section.querySelector<HTMLElement>('[data-actions]')!;
  const caption = section.querySelector<HTMLElement>('[data-caption]')!;
  const layers = [...section.querySelectorAll<HTMLImageElement>('img[data-src]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const catalog = document.getElementById('models')!;
  let active = root.classList.contains('home-motion');
  let ready = false;
  let failed = false;
  let frame = 0;
  let resizeFrame = 0;
  let generation = 0;
  let start = 0;
  let travel = 1;
  let introHeight = 0;

  function measure() {
    start = section.getBoundingClientRect().top + scrollY;
    travel = stage.clientHeight * HOME_MOTION.scrollScreens;
    introHeight = intro.scrollHeight;
  }

  function fits() {
    return innerWidth >= HOME_MOTION.minWidth && innerHeight >= HOME_MOTION.minHeight &&
      !reduced.matches && 'ResizeObserver' in window &&
      'decode' in HTMLImageElement.prototype && 'inert' in HTMLElement.prototype &&
      CSS.supports('height', '100svh');
  }

  function copyFits() {
    const rect = intro.getBoundingClientRect();
    // Include the header in the available height of the first screen.
    const header = document.querySelector('header')!.getBoundingClientRect();
    return introHeight + Math.max(0, header.bottom) + 96 < innerHeight &&
      rect.width < innerWidth * 0.52 && intro.scrollWidth <= intro.clientWidth + 1;
  }

  function render() {
    frame = 0;
    if (!active || !ready) return;
    const state = homeMotionState((scrollY - start) / travel);
    const hasIntroFocus = intro.contains(document.activeElement);
    const hasCaptionFocus = caption.contains(document.activeElement);
    stage.style.setProperty('--cat-height', `${state.catHeight}%`);
    stage.style.setProperty('--cat-x', `${state.catX}%`);
    stage.style.setProperty('--cat-bottom', `${state.catBottom}%`);
    stage.style.setProperty('--printer-scale', String(state.printerScale));
    stage.style.setProperty('--door-detail', String(state.doorDetail));
    stage.style.setProperty('--printer-opacity', String(state.printerOpacity));
    stage.style.setProperty('--workshop-opacity', String(state.workshopOpacity));
    stage.style.setProperty('--warmth', String(state.warmth));
    stage.style.setProperty('--reflection', String(state.reflection));
    stage.style.setProperty('--intro-opacity', String(hasCaptionFocus ? 0 : hasIntroFocus ? 1 : state.introOpacity));
    stage.style.setProperty('--caption-opacity', String(hasIntroFocus ? 0 : hasCaptionFocus ? 1 : state.captionOpacity));
    actions.inert = hasCaptionFocus || (!hasIntroFocus && state.introOpacity < 0.05);
    caption.inert = !hasCaptionFocus && (hasIntroFocus || state.captionOpacity < 0.95);
    section.dataset.progress = state.progress.toFixed(3);
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  // Keep a visible catalog card at the same viewport offset when removing
  // the long section. Inside the story, return to the ordinary hero.
  function disable() {
    if (!active) return;
    const focusedLink = caption.contains(document.activeElement) ? document.activeElement as HTMLAnchorElement : null;
    const focusTarget = focusedLink ? [...catalog.querySelectorAll<HTMLAnchorElement>('a[href]')]
      .find(link => link.href === focusedLink.href) : undefined;
    const below = scrollY >= start + section.offsetHeight - innerHeight;
    const cards = [...catalog.querySelectorAll<HTMLElement>('.model-card')];
    const anchor = below ? cards.find(card => card.getBoundingClientRect().bottom > 0) ?? catalog : null;
    const offset = anchor?.getBoundingClientRect().top;
    const inIntro = scrollY > start && !below;
    active = false;
    ready = false;
    generation++;
    root.classList.remove('home-motion');
    section.removeAttribute('data-ready');
    stage.removeAttribute('style');
    actions.inert = false;
    caption.inert = true;
    removeEventListener('scroll', schedule);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    for (const layer of layers) layer.removeAttribute('src');
    if (anchor && offset !== undefined) scrollBy(0, anchor.getBoundingClientRect().top - offset);
    else if (inIntro) scrollTo(0, start);
    // The final link disappears in static mode. Keep keyboard users on the
    // same model, using its ordinary catalog card and a visible focus ring.
    if (focusTarget) {
      focusTarget.focus({ preventScroll: true });
      focusTarget.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
    measure();
  }

  async function load() {
    const current = ++generation;
    try {
      const firstImages = [...section.querySelectorAll<HTMLImageElement>('img[data-first]')];
      await Promise.all([...firstImages, ...layers].map(async image => {
        try {
          if (image.dataset.src) image.src = image.dataset.src;
          await image.decode();
          if (!image.naturalWidth) throw new Error('Empty home scene layer');
        } catch (error) {
          // A failed workshop/detail only disables motion. Preserve the new
          // static cat/printer whenever those first-frame images are healthy.
          if (current === generation && firstImages.includes(image)) section.dataset.failed = '';
          throw error;
        }
      }));
      if (current !== generation || !active) return;
      ready = true;
      section.dataset.ready = '';
      schedule();
    } catch {
      if (current !== generation) return;
      failed = true;
      disable();
    }
  }

  function enable() {
    if (active || failed || !fits()) return;
    // Never insert a spacer above someone reading the catalog or navigating
    // to an anchor. Wait until they return to the top of the hero.
    if (scrollY > start + 1 || location.hash) return;
    active = true;
    root.classList.add('home-motion');
    measure();
    if (!copyFits()) { disable(); return; }
    addEventListener('scroll', schedule, { passive: true });
    void load();
  }

  function updateMode() {
    resizeFrame = 0;
    measure();
    if (active && (!fits() || !copyFits())) disable();
    else if (!active) enable();
    if (active && ready) schedule();
  }

  // Before media are decoded retain H01. Once ready, a single RAF updates
  // only composited styles; layout reads happen on resize, never per scroll.
  measure();
  if (active) {
    if (!fits() || !copyFits()) disable();
    else {
      addEventListener('scroll', schedule, { passive: true });
      void load();
    }
  }
  const resize = () => {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(updateMode);
  };
  addEventListener('resize', resize, { passive: true });
  reduced.addEventListener('change', updateMode);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(intro);
  document.fonts?.ready.then(resize);
  // This small passive listener permits deferred activation at the top.
  addEventListener('scroll', () => { if (!active && !failed && scrollY <= start + 1) enable(); }, { passive: true });
  section.addEventListener('focusin', schedule);
  section.addEventListener('focusout', schedule);
  addEventListener('pageshow', () => {
    measure();
    if (active && (location.hash || (!ready && scrollY > start + 1 && !root.hasAttribute('data-home-restoring')))) disable();
    else if (active) updateMode();
  });
  // Native fragment navigation skips all intermediate animation frames.
  addEventListener('hashchange', () => { if (location.hash && active && !ready) disable(); });
  for (const image of section.querySelectorAll<HTMLImageElement>('img[data-first]')) {
    const fail = () => {
      failed = true;
      section.dataset.failed = '';
      disable();
    };
    image.addEventListener('error', fail);
    if (image.complete && !image.naturalWidth) fail();
  }
}
