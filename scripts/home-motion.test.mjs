import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { HOME_MOTION, homeMotionState } from '../src/scripts/home-motion-state.ts';

const controller = stripTypeScriptTypes(await readFile(new URL('../src/scripts/home-motion.ts', import.meta.url), 'utf8'))
  .replace(/^import[^;]+;\s*/, '');

// A controller harness for mode/focus/resource behavior. This deliberately
// does not simulate CSS, layout, image rendering or a browser acceptance test.
async function mount({ observer = true, failedMedia = false, failedFirst = false, active = true, hash = '', scrollY = 0 } = {}) {
  const classes = new Set(active ? ['home-motion'] : []);
  const listeners = new Map(), frames = new Map(), styles = new Map();
  let frameId = 0;
  const listen = (type, callback) => listeners.set(type, [...(listeners.get(type) ?? []), callback]);
  const root = { hasAttribute: () => false, classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) } };
  const actions = { inert: false };
  const caption = { inert: true, contains: element => element?.owner === 'caption' };
  const intro = {
    scrollHeight: 300, scrollWidth: 500, clientWidth: 500,
    contains: element => element?.owner === 'intro',
    getBoundingClientRect: () => ({ width: 500 }),
  };
  const stage = {
    clientHeight: 900,
    style: { setProperty: (key, value) => styles.set(key, value) },
    removeAttribute: () => styles.clear(),
  };
  const image = (failure = false) => ({
    complete: false, naturalWidth: 0, dataset: {}, listeners: new Map(),
    addEventListener(type, callback) { this.listeners.set(type, callback); },
    removeAttribute(name) { delete this[name]; },
    async decode() { if (failure) throw Error('Media unavailable'); this.complete = true; this.naturalWidth = 1152; },
  });
  const first = image(failedFirst), layer = image(failedMedia);
  layer.dataset.src = '/scene.webp';
  const section = {
    dataset: {},
    querySelector: selector => ({ '[data-stage]': stage, '[data-intro]': intro, '[data-actions]': actions, '[data-caption]': caption })[selector],
    querySelectorAll: selector => selector === 'img[data-src]' ? [layer] : [first],
    getBoundingClientRect: () => ({ top: 72 - context.scrollY }),
    get offsetHeight() { return classes.has('home-motion') ? 2700 : 500; },
    removeAttribute(name) { if (name === 'data-ready') delete this.dataset.ready; },
    addEventListener: listen,
  };
  const card = {
    href: '/models/robot-cat/',
    focus() { document.activeElement = this; },
    scrollIntoView() { context.scrollY = 650; },
    getBoundingClientRect: () => ({ top: (classes.has('home-motion') ? 2850 : 650) - context.scrollY, bottom: (classes.has('home-motion') ? 3150 : 950) - context.scrollY }),
  };
  const catalog = { querySelectorAll: () => [card] };
  const reduced = { matches: false, addEventListener: listen };
  const document = {
    documentElement: root, activeElement: null, fonts: { ready: Promise.resolve() },
    querySelector: selector => selector === '[data-home-motion]' ? section : { getBoundingClientRect: () => ({ bottom: 72 }) },
    getElementById: () => catalog,
  };
  const context = {
    HOME_MOTION, homeMotionState, document, innerWidth: 1440, innerHeight: 900, scrollY,
    matchMedia: () => reduced, location: { hash }, CSS: { supports: () => true },
    HTMLElement: { prototype: { inert: false } }, HTMLImageElement: { prototype: { decode() {} } },
    addEventListener: listen,
    removeEventListener(type, callback) { listeners.set(type, (listeners.get(type) ?? []).filter(fn => fn !== callback)); },
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    scrollBy(x, y) { context.scrollY += y; }, scrollTo(x, y) { context.scrollY = y; },
  };
  context.window = context;
  if (observer) context.ResizeObserver = class { observe() {} };
  runInNewContext(controller, context);
  const flush = async () => {
    await new Promise(setImmediate);
    for (let i = 0; frames.size && i < 10; i++) {
      const callbacks = [...frames.values()]; frames.clear();
      callbacks.forEach(callback => callback());
    }
  };
  const emit = type => (listeners.get(type) ?? []).forEach(callback => callback());
  await flush();
  return { classes, context, styles, section, actions, caption, document, reduced, card, first, layer, emit, flush };
}

test('subject stays on the same camera/bed until the door crossing', () => {
  const initial = homeMotionState(0);
  for (const progress of [.15, .23, .31, .4, .45]) {
    const state = homeMotionState(progress);
    assert.ok(Math.abs(state.catHeight / state.printerScale - initial.catHeight) < 1e-9);
    assert.ok(Math.abs((100 - state.catBottom - 59) / state.printerScale - 14) < 1e-9);
    assert.equal(state.catX, initial.catX);
  }
});

test('unavailable ResizeObserver leaves a usable static page', async () => {
  const page = await mount({ observer: false, active: false });
  assert.equal(page.classes.has('home-motion'), false);
  assert.equal(page.layer.src, undefined);
  assert.equal(page.actions.inert, false);
});

test('deferred decode failure removes enhancement and preserves the healthy static cat/printer', async () => {
  const page = await mount({ failedMedia: true });
  assert.equal(page.classes.has('home-motion'), false);
  assert.equal(page.section.dataset.failed, undefined);
  assert.equal(page.layer.src, undefined);
  assert.equal(page.actions.inert, false);
});

test('first-frame decode failure selects emergency media', async () => {
  const page = await mount({ failedFirst: true });
  assert.equal(page.classes.has('home-motion'), false);
  assert.equal(page.section.dataset.failed, '');
  assert.equal(page.actions.inert, false);
});

test('scroll seek is reversible; focused CTA remains visible and usable', async () => {
  const page = await mount();
  page.context.scrollY = 72 + 1800 * .9;
  page.emit('scroll'); await page.flush();
  assert.equal(page.actions.inert, true);
  assert.equal(page.caption.inert, false);
  const finalHeight = page.styles.get('--cat-height');
  page.document.activeElement = { owner: 'intro' };
  page.emit('focusin'); await page.flush();
  assert.equal(page.styles.get('--intro-opacity'), '1');
  assert.equal(page.actions.inert, false);
  assert.equal(page.caption.inert, true);
  page.document.activeElement = null;
  page.context.scrollY = 72;
  page.emit('scroll'); await page.flush();
  assert.equal(page.styles.get('--cat-height'), '27%');
  page.context.scrollY = 72 + 1800 * .9;
  page.emit('scroll'); await page.flush();
  assert.equal(page.styles.get('--cat-height'), finalHeight);
});

test('live reduced motion keeps the reader at the same catalog card', async () => {
  const page = await mount();
  page.context.scrollY = 2900;
  const offset = page.card.getBoundingClientRect().top;
  page.reduced.matches = true;
  page.emit('change'); await page.flush();
  assert.equal(page.classes.has('home-motion'), false);
  assert.equal(page.card.getBoundingClientRect().top, offset);
  assert.equal(page.actions.inert, false);
  page.reduced.matches = false;
  page.emit('change'); await page.flush();
  assert.equal(page.classes.has('home-motion'), false, 'do not reinsert the story above the reader');
});

test('a focused final link stays visible on reverse seek and transfers to its catalog card in static mode', async () => {
  const page = await mount();
  page.document.activeElement = { owner: 'caption', href: '/models/robot-cat/' };
  page.context.scrollY = 72;
  page.emit('focusin'); await page.flush();
  assert.equal(page.styles.get('--caption-opacity'), '1');
  assert.equal(page.styles.get('--intro-opacity'), '0');
  assert.equal(page.actions.inert, true);
  page.reduced.matches = true;
  page.emit('change'); await page.flush();
  assert.equal(page.document.activeElement, page.card);
  assert.equal(page.card.getBoundingClientRect().top, 0);
});

test('fragment navigation and restored catalog position defer enhancement until return to hero', async () => {
  for (const hash of ['#models', '']) {
    const page = await mount({ active: false, hash, scrollY: 2900 });
    page.emit('pageshow'); await page.flush();
    assert.equal(page.classes.has('home-motion'), false);
    assert.equal(page.layer.src, undefined);
    page.context.location.hash = '';
    page.context.scrollY = 0;
    page.emit('scroll'); await page.flush();
    assert.equal(page.classes.has('home-motion'), true);
    assert.equal(page.layer.src, '/scene.webp');
  }
});

test('return from browser cache rechecks a changed viewport without relying on resize', async () => {
  const page = await mount();
  page.context.scrollY = 2900;
  const offset = page.card.getBoundingClientRect().top;
  page.context.innerWidth = 1024;
  page.emit('pageshow'); await page.flush();
  assert.equal(page.classes.has('home-motion'), false);
  assert.equal(page.card.getBoundingClientRect().top, offset);
});
