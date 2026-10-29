import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const geometry = (await readFile('src/scripts/internal-transition-geometry.js', 'utf8')).replace(/^export /gm, '');
const runtime = await readFile('src/scripts/internal-transition-runtime.js', 'utf8');

// Event/cleanup harness only: this cannot prove native snapshot rendering.
async function mount({ destination = false, store = new Map(), readyCover = true,
    width = 1440, height = 900, reduce = false, failStyle = false,
    prepareDocument = true, fontsLoaded = true, model = 'robot-cat' } = {}) {
  const events = new Map(), docEvents = new Map();
  const listen = map => (type, listener) => map.set(type, [...(map.get(type) ?? []), listener]);
  const root = { dataset: {}, removeAttribute: () => delete root.dataset.pageMotion };
  const cover = { currentSrc: '/photo.webp', complete: true, style: {},
    naturalWidth: 1200, naturalHeight: 1600,
    decode: () => readyCover ? Promise.resolve() : Promise.reject(Error('decode failed')), addEventListener() {},
    getBoundingClientRect: () => ({ left: 100, top: 200, width: 320, height: 240 }),
    parentElement: { style: {}, getBoundingClientRect: () => ({ left: 100, top: 200, width: 320, height: 240 }) } };
  class Element {}
  const link = Object.assign(new Element(), { href: `https://site.test/models/${model}/`,
    dataset: { modelId: model, motionSource: 'catalog', coverKey: 'same-photo' },
    closest() { return this; }, hasAttribute: () => false, querySelector: selector => selector === 'img' ? cover : title });
  const heading = { style: {} };
  const title = { style: {} };
  const reduced = { matches: reduce, addEventListener: listen(events) };
  const clones = [];
  const document = {
    documentElement: root, fonts: { status: fontsLoaded ? 'loaded' : 'loading' },
    addEventListener: listen(docEvents),
    querySelectorAll: () => [cover],
    querySelector: selector => ({ '.cover img': destination ? cover : null,
      '[data-model-page]': { dataset: { modelPage: model, coverKey: 'same-photo' } },
      '.model-head': heading, '.model-head [data-model-title]': title })[selector],
    createElement: () => ({ textContent: '', style: {}, setAttribute() {}, remove() { this.removed = true; } }),
    body: { append: clone => clones.push(clone) }, head: { append() { if (failStyle) throw Error('style unavailable'); } },
  };
  const context = {
    document, Element, innerWidth: width, innerHeight: height, URL,
    location: { href: destination ? link.href : 'https://site.test/', hash: '' },
    matchMedia: () => reduced,
    MutationObserver: class { observe() {} disconnect() {} },
    addEventListener: listen(events),
    getComputedStyle: () => ({ objectPosition: '50% 50%', objectFit: 'cover', backgroundColor: 'rgb(255, 255, 255)' }),
    sessionStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
    navigation: { activation: { from: { url: 'https://site.test/', key: 'entry-A' }, navigationType: 'push' } },
  };
  context.window = context;
  runInNewContext(`(() => {${geometry}\n${runtime}})()`, context);
  const emit = (type, value = {}) => { for (const listener of events.get(type) ?? []) listener(value); };
  const click = (value = {}) => { for (const listener of docEvents.get('click')) listener({ target: link, button: 0, ...value }); };
  if (prepareDocument) emit('DOMContentLoaded');
  await Promise.resolve(); await Promise.resolve();
  let resolveReady, resolveFinished;
  const transition = { skipped: false, skipTransition() { this.skipped = true; },
    ready: new Promise(resolve => { resolveReady = resolve; }),
    finished: new Promise(resolve => { resolveFinished = resolve; }) };
  const swap = () => emit('pageswap', { viewTransition: transition,
    activation: { entry: { url: link.href }, from: { key: 'entry-A' }, navigationType: 'push' } });
  return { emit, click, swap, transition, resolveReady, resolveFinished, store, root, cover, clones, link, heading, title, reduced };
}

test('actual hero link is handed off even when the model also has a card', async () => {
  const source = await mount();
  source.link.dataset.motionSource = 'hero';
  source.click(); source.swap();
  const data = JSON.parse([...source.store.values()][0]);
  assert.equal(data.source, 'hero');
  const destination = await mount({ destination: true, store: source.store });
  destination.emit('pagereveal', { viewTransition: destination.transition });
  assert.equal(destination.root.dataset.pageMotion, 'hero');
  assert.equal(destination.heading.style.viewTransitionName, 'model-heading');
  assert.equal(source.store.size, 0, 'handoff is consumed once');
  destination.resolveFinished(); await Promise.resolve();
  assert.equal(destination.heading.style.viewTransitionName, '');
});
test('spatial source cleanup restores the original before bfcache return', async () => {
  const source = await mount();
  source.click(); source.swap();
  assert.equal(source.cover.style.visibility, 'hidden');
  assert.equal(source.clones.length, 1);
  source.resolveReady(); await Promise.resolve();
  assert.equal(source.cover.style.visibility, '');
  assert.equal(source.clones[0].removed, true);
});
test('ordinary initial focus/scroll does not cancel before native animation readiness', async () => {
  const source = await mount(); source.click(); source.swap();
  const destination = await mount({ destination: true, store: source.store });
  destination.emit('pagereveal', { viewTransition: destination.transition });
  destination.emit('focusin'); destination.emit('scroll');
  assert.equal(destination.transition.skipped, false);
  destination.resolveReady(); await Promise.resolve();
  destination.emit('scroll');
  assert.equal(destination.transition.skipped, true);
  assert.equal(destination.cover.style.visibility, '');
  assert.equal(destination.title.style.viewTransitionName, '');
});
test('new input, viewport changes and reduced motion finish the effect', async () => {
  for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'resize', 'change']) {
    const source = await mount(); source.click(); source.swap();
    const destination = await mount({ destination: true, store: source.store });
    destination.emit('pagereveal', { viewTransition: destination.transition });
    destination.reduced.matches = true;
    destination.emit(event);
    assert.equal(destination.transition.skipped, true, event);
    assert.equal(destination.cover.style.visibility, '');
    assert.equal(destination.title.style.viewTransitionName, '');
  }
});
test('modified clicks do not create handoff state', async () => {
  const page = await mount(); page.click({ metaKey: true }); page.swap();
  assert.equal(page.store.size, 0);
  assert.equal(page.transition.skipped, true);
});
test('title still moves when the image or fonts need the fade fallback', async () => {
  for (const options of [{ readyCover: false }, { prepareDocument: false }, { fontsLoaded: false }]) {
    const source = await mount(); source.click(); source.swap();
    const destination = await mount({ destination: true, store: source.store, ...options });
    destination.emit('pagereveal', { viewTransition: destination.transition });
    assert.equal(destination.transition.skipped, false);
    assert.equal(destination.root.dataset.pageMotion, 'catalog');
    assert.equal(destination.title.style.viewTransitionName, 'model-title-robot-cat');
    destination.resolveFinished(); await Promise.resolve();
    assert.equal(destination.title.style.viewTransitionName, '');
  }
});
test('static mode is restored at exact viewport boundaries and for reduced motion', async () => {
  for (const width of [1279, 1280, 1281]) for (const height of [799, 800, 801]) {
    const page = await mount({ width, height }); page.click(); page.swap();
    assert.equal(page.transition.skipped, width < 1280 || height < 800);
  }
  const page = await mount({ reduce: true }); page.click(); page.swap();
  assert.equal(page.transition.skipped, true);
  assert.equal(page.store.size, 0);
});
test('an incompatible asset fades while its title keeps the shared name', async () => {
  const source = await mount(); source.link.dataset.coverKey = 'different-photo'; source.click(); source.swap();
  const destination = await mount({ destination: true, store: source.store });
  destination.emit('pagereveal', { viewTransition: destination.transition });
  assert.equal(destination.transition.skipped, false);
  assert.equal(destination.root.dataset.pageMotion, 'catalog');
  assert.equal(destination.title.style.viewTransitionName, 'model-title-robot-cat');
  assert.equal(destination.clones.length, 0);
});
test('an exception restores readable HTML and clears shared names', async () => {
  const source = await mount(); source.click(); source.swap();
  const destination = await mount({ destination: true, store: source.store, failStyle: true });
  destination.emit('pagereveal', { viewTransition: destination.transition });
  assert.equal(destination.transition.skipped, true);
  assert.equal(destination.cover.style.visibility ?? '', '');
  assert.equal(destination.title.style.viewTransitionName, '');
});
test('each published card pairs its own image and title and cleans both on completion', async () => {
  for (const model of ['robot-cat', 'animal-puzzle', 'bunny-meds', 'letters-blocks', 'med-box', 'teeth-box']) {
    const source = await mount({ model }); source.click(); source.swap();
    assert.equal(source.title.style.viewTransitionName, `model-title-${model}`);
    assert.ok(source.clones[0].style.cssText.includes(`view-transition-name:model-${model}`));
    const destination = await mount({ destination: true, store: source.store, model });
    destination.emit('pagereveal', { viewTransition: destination.transition });
    assert.equal(destination.root.dataset.pageMotion, 'spatial');
    assert.equal(destination.title.style.viewTransitionName, source.title.style.viewTransitionName);
    assert.ok(destination.clones[0].style.cssText.includes(`view-transition-name:model-${model}`));
    destination.resolveFinished(); source.resolveReady(); await Promise.resolve();
    assert.equal(destination.title.style.viewTransitionName, '');
    assert.equal(source.title.style.viewTransitionName, '');
    assert.equal(destination.cover.style.visibility, '');
  }
});
