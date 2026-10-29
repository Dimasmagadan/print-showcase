// Inlined by InternalMotionHead with imageGeometry and validTransition.
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const eligible = () => innerWidth >= 1280 && innerHeight >= 800 && !reduced.matches;
const storageKey = 'print-showcase:internal-transition:v1';
let transition, selected, clone, hidden, heading, styles, backdrop;
let running = false, title;
const decoded = new WeakMap();
const preparing = new WeakSet();
const clearImage = () => {
  clone?.remove(); clone = null;
  if (hidden) hidden.style.visibility = '';
  hidden = null;
  if (backdrop) backdrop.element.style.backgroundColor = backdrop.previous;
  backdrop = null;
};
const reset = () => {
  running = false;
  root.removeAttribute('data-page-motion');
  clearImage();
  if (heading) heading.style.viewTransitionName = '';
  heading = null;
  if (title) title.style.viewTransitionName = '';
  title = null;
  styles?.remove(); styles = null;
  transition = null;
};
const finish = () => {
  transition?.skipTransition();
  reset();
};
for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'resize']) {
  addEventListener(type, () => { if (transition) finish(); }, { passive: true });
}
for (const type of ['scroll', 'focusin']) {
  // Initial native scroll/focus restoration is not user interruption. Tab,
  // wheel and pointer input above still cancel before the animation starts.
  addEventListener(type, () => { if (running) finish(); }, { passive: true });
}
reduced.addEventListener('change', () => { if (reduced.matches && transition) finish(); });
addEventListener('pageshow', event => { if (event.persisted) { reset(); selected = null; } });
addEventListener('pagehide', () => { selected = null; });

const prepare = () => {
  for (const image of document.querySelectorAll('.model-card img, .cover img')) {
    if (preparing.has(image)) continue;
    preparing.add(image);
    const decode = () => {
      const resource = image.currentSrc;
      image.decode?.().then(() => {
        if (image.currentSrc === resource) decoded.set(image, resource);
      }).catch(() => {});
    };
    if (image.complete) decode();
    image.addEventListener('load', decode);
  }
};
const parsing = new MutationObserver(prepare);
parsing.observe(root, { childList: true, subtree: true });
addEventListener('DOMContentLoaded', () => { prepare(); parsing.disconnect(); }, { once: true });

function shareTitle(element, model) {
  if (!element) return false;
  title = element;
  title.style.viewTransitionName = `model-title-${model}`;
  return true;
}
function watch(current) {
  current.ready.then(() => { if (current === transition) running = true; }, () => { running = false; });
  current.finished.then(reset, reset);
}

document.addEventListener('click', event => {
  selected = null;
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target instanceof Element && event.target.closest('a[data-model-id]');
  if (link && !link.target && !link.hasAttribute('download')) selected = link;
});

function snapshot(image, model) {
  const frame = image.parentElement;
  const box = image.getBoundingClientRect();
  const border = frame.getBoundingClientRect();
  const computed = getComputedStyle(image);
  if (computed.objectPosition !== '50% 50%') return null;
  const geometry = imageGeometry(box, border, image.naturalWidth, image.naturalHeight, computed.objectFit);
  if (!geometry) return null;
  geometry.radius = geometry.width < border.width - 2 || geometry.height < border.height - 2
    ? 0 : parseFloat(getComputedStyle(frame).borderRadius) || 0;
  clone = document.createElement('img');
  clone.src = image.currentSrc;
  clone.alt = '';
  clone.setAttribute('aria-hidden', 'true');
  // Reuse the decoded resource: no larger card request or new bitmap asset.
  clone.style.cssText = `position:fixed;left:${geometry.left}px;top:${geometry.top}px;width:${geometry.width}px;height:${geometry.height}px;max-width:none;max-height:none;object-fit:fill;pointer-events:none;z-index:1000;view-transition-name:model-${model}`;
  document.body.append(clone);
  if (computed.backgroundColor !== 'rgba(0, 0, 0, 0)' && computed.backgroundColor !== 'transparent') {
    backdrop = { element: frame, previous: frame.style.backgroundColor };
    frame.style.backgroundColor = computed.backgroundColor;
  }
  hidden = image;
  image.style.visibility = 'hidden';
  return geometry;
}
function fadeFallback(data) {
  root.dataset.pageMotion = 'catalog';
  if (!data.geometry) return;
  // The old image was captured separately. Keep it at its original clipped
  // position while fading out; never expose the uncropped full photograph.
  if (!styles) { styles = document.createElement('style'); document.head.append(styles); }
  styles.textContent += `
    ::view-transition-group(model-${data.model}){animation:none;clip-path:inset(${data.geometry.inset.map(n => `${n}%`).join(' ')} round ${data.geometry.radius}px)}
    ::view-transition-old(model-${data.model}){animation:internal-out 90ms ease-out both}
    ::view-transition-new(model-${data.model}){animation:none;opacity:0}`;
}
addEventListener('pageswap', event => {
  try {
  transition = event.viewTransition;
  if (!transition) return;
  const activation = event.activation;
  const destination = activation?.entry?.url;
  if (!eligible() || !selected || selected.href !== destination ||
      ['traverse', 'reload'].includes(activation.navigationType) ||
      new URL(destination).hash) { finish(); return; }
  const image = selected.querySelector('img');
  const source = selected.dataset.motionSource;
  const data = { version: 1, from: location.href, to: destination,
    key: activation.from?.key, time: Date.now(), source,
    model: selected.dataset.modelId, asset: selected.dataset.coverKey ?? '', geometry: null, title: false };
  if (source === 'catalog') {
    if (image && decoded.get(image) === image.currentSrc) data.geometry = snapshot(image, data.model);
    data.title = shareTitle(selected.querySelector('[data-model-title]'), data.model);
  }
  try { sessionStorage.setItem(storageKey, JSON.stringify(data)); }
  catch { finish(); return; }
  root.dataset.pageMotion = source === 'hero' ? 'hero' : 'catalog';
  // Once capture is complete restore the outgoing DOM for bfcache.
  transition.ready.then(reset, reset);
  } catch { finish(); }
});
addEventListener('pagereveal', event => {
  try {
  transition = event.viewTransition;
  if (!transition) return;
  let data;
  try {
    data = JSON.parse(sessionStorage.getItem(storageKey));
    sessionStorage.removeItem(storageKey);
  } catch { finish(); return; }
  const activation = window.navigation?.activation;
  const cover = document.querySelector('.cover img');
  const article = document.querySelector('[data-model-page]');
  if (!eligible() || ['traverse', 'reload'].includes(activation?.navigationType) || location.hash ||
      !validTransition(data, activation?.from?.url, location.href, activation?.from?.key, Date.now()) ||
      article?.dataset.modelPage !== data.model) { finish(); return; }
  root.dataset.pageMotion = data.source;
  // Heading is a real shared View Transition element, independently of media
  // readiness: the card label travels into H1 rather than fading in a header.
  if (data.source === 'catalog' && data.title) {
    if (!shareTitle(document.querySelector('.model-head [data-model-title]'), data.model)) { finish(); return; }
    styles = document.createElement('style');
    styles.textContent = `
      ::view-transition-group(model-title-${data.model}){animation-duration:360ms;animation-timing-function:cubic-bezier(.22,1,.36,1)}
      ::view-transition-old(model-title-${data.model}),::view-transition-new(model-title-${data.model}){width:100%;height:100%;object-fit:contain;object-position:left top;mix-blend-mode:plus-lighter}
      ::view-transition-old(model-title-${data.model}){animation:internal-out 180ms ease both}
      ::view-transition-new(model-title-${data.model}){animation:internal-in 280ms 40ms ease both}`;
    document.head.append(styles);
  }
  if (!cover || decoded.get(cover) !== cover.currentSrc || document.fonts.status !== 'loaded') {
    fadeFallback(data);
    watch(transition);
    return;
  }
  // An outgoing named snapshot must never be left unpaired: its full image
  // may extend beyond the old card crop. Skip rather than flash that image.
  if (data.source === 'catalog' && data.geometry && article.dataset.coverKey !== data.asset) {
    fadeFallback(data); watch(transition); return;
  }
  if (data.source === 'hero') {
    heading = document.querySelector('.model-head');
    heading.style.viewTransitionName = 'model-heading';
  }
  if (data.source === 'catalog' && data.geometry && article.dataset.coverKey === data.asset) {
    const target = snapshot(cover, data.model);
    if (target && Math.abs(data.geometry.width / data.geometry.height - target.width / target.height) < .01) {
      root.dataset.pageMotion = 'spatial';
      if (!styles) { styles = document.createElement('style'); document.head.append(styles); }
      styles.textContent += `
        ::view-transition-group(model-${data.model}){animation-duration:360ms;animation-timing-function:cubic-bezier(.22,1,.36,1);overflow:hidden}
        ::view-transition-old(model-${data.model}){animation:none;opacity:0}
        ::view-transition-new(model-${data.model}){animation:none;width:100%;height:100%;object-fit:contain;clip-path:inset(0);animation:internal-crop 360ms cubic-bezier(.22,1,.36,1) both}
        @keyframes internal-crop{from{clip-path:inset(${data.geometry.inset.map(n => `${n}%`).join(' ')} round ${data.geometry.radius}px)}to{clip-path:inset(${target.inset.map(n => `${n}%`).join(' ')} round ${target.radius}px)}}`;
    } else { clearImage(); fadeFallback(data); watch(transition); return; }
  }
  watch(transition);
  } catch { finish(); }
});
