import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { readHomeReturn } from '../src/scripts/internal-history.ts';
import { HOME_MOTION } from '../src/scripts/home-motion-state.ts';

const source = stripTypeScriptTypes(await readFile('src/scripts/internal-motion.ts', 'utf8'))
  .replace(/^import[^;]+;\s*/gm, '');
const saved = { version: 1, model: 'robot-cat', source: 'hero', motion: true,
  offset: 120, progress: .9, keyboard: true };

function mount({ state = saved, motion = true, ready = true, hash = '', type = 'back_forward' } = {}) {
  const listeners = new Map(), frames = new Map(), observers = [];
  const classes = new Set(motion ? ['home-motion'] : []);
  let id = 0, focused = null, restoring = true;
  const listen = (type, callback, options) => listeners.set(type, [...(listeners.get(type) ?? []), { callback, options }]);
  const emit = (type, event = {}) => {
    for (const { callback, options } of listeners.get(type) ?? []) if (!options?.signal?.aborted) callback(event);
  };
  const document = {
    documentElement: { classList: { contains: key => classes.has(key) }, removeAttribute() { restoring = false; } },
    querySelector: () => scene, querySelectorAll: () => [card], addEventListener: listen,
  };
  const focusable = name => ({ setAttribute() {}, removeAttribute() {}, addEventListener() {},
    focus() { focused = name; emit('focusin'); } });
  const link = { ...focusable('hero'), dataset: { modelId: 'robot-cat', motionSource: 'hero' }, hasAttribute: () => false };
  const card = { ...focusable('card'), dataset: { modelId: 'robot-cat', motionSource: 'catalog' },
    hasAttribute: () => false,
    getBoundingClientRect: () => ({ top: (classes.has('home-motion') ? 2850 : 650) - context.scrollY }),
    scrollIntoView() { context.scrollY = 650; } };
  const scene = { offsetTop: 72, dataset: { progress: '.9' },
    hasAttribute: () => ready,
    querySelector: selector => selector === '[data-stage]' ? { clientHeight: 900 } : link };
  const history = { state: { other: 'preserve', homeReturn: state },
    replaceState(value) { this.state = value; } };
  const context = {
    document, history, readHomeReturn, HOME_MOTION, AbortController,
    location: { hash }, performance: { getEntriesByType: () => [{ type }] },
    scrollY: 0, addEventListener: listen,
    requestAnimationFrame(callback) { frames.set(++id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    scrollTo(x, y) { context.scrollY = y; }, scrollBy(x, y) { context.scrollY += y; },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.active = true; observers.push(this); }
      observe() {} disconnect() { this.active = false; }
    },
  };
  runInNewContext(source, context);
  const frame = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); };
  const mutate = () => observers.filter(o => o.active).forEach(o => o.callback());
  return { emit, frame, context, history, classes, card, link, frames,
    get focused() { return focused; }, get restoring() { return restoring; },
    get waiting() { return observers.some(o => o.active); },
    mediaReady() { ready = true; mutate(); }, modeFailed() { classes.clear(); mutate(); } };
}

test('new history document restores hero progress and focuses after the scene frame', () => {
  const page = mount(); page.emit('pageshow', { persisted: false });
  page.frame();
  assert.equal(page.context.scrollY, 72 + 1800 * .9);
  assert.equal(page.focused, null);
  page.frame(); assert.equal(page.focused, 'hero');
  assert.equal(page.restoring, false);
});
test('scene decode failure restores the matching static card instead of old absolute scroll', () => {
  const page = mount({ ready: false }); page.emit('pageshow', { persisted: false });
  assert.equal(page.waiting, true);
  page.modeFailed(); page.frame(); page.frame();
  assert.equal(page.context.scrollY, 650 - 96);
  assert.equal(page.focused, 'card');
});
test('bfcache keeps native scroll and focus when scene geometry is still compatible', () => {
  const page = mount(); page.context.scrollY = 1630;
  page.emit('pageshow', { persisted: true }); page.frame(); page.frame();
  assert.equal(page.context.scrollY, 1630);
  assert.equal(page.focused, null);
});
test('bfcache with an unavailable hero restores its card after the home mode check', () => {
  const page = mount(); page.emit('pageshow', { persisted: true });
  page.classes.clear(); page.frame(); page.frame();
  assert.equal(page.context.scrollY, 650);
  assert.equal(page.focused, 'card');
});
test('catalog restoration uses the saved card offset and preserves pointer focus', () => {
  const page = mount({ state: { ...saved, source: 'catalog', keyboard: false }, motion: false });
  page.emit('pageshow', { persisted: false }); page.frame();
  assert.equal(page.context.scrollY, 650 - saved.offset);
  assert.equal(page.focused, null);
});
test('new input cancels both a media wait and a queued restoration', () => {
  for (const ready of [true, false]) {
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'focusin', 'pagehide']) {
      const page = mount({ ready }); page.emit('pageshow', { persisted: false });
      page.emit(event); page.mediaReady(); page.frame(); page.frame();
      assert.equal(page.context.scrollY, 0, `${event}, ready=${ready}`);
      assert.equal(page.focused, null);
      assert.equal(page.waiting, false);
      assert.equal(page.restoring, false);
    }
  }
});
test('new focus between scroll restoration and its focus frame is preserved', () => {
  const page = mount(); page.emit('pageshow', { persisted: false }); page.frame();
  page.emit('focusin'); page.frame();
  assert.equal(page.focused, null);
});
test('reload, anchor and malformed metadata leave browser restoration alone', () => {
  for (const options of [{ type: 'reload' }, { hash: '#models' }, { state: {} }]) {
    const page = mount(options); page.emit('pageshow', { persisted: false }); page.frame();
    assert.equal(page.context.scrollY, 0);
    assert.equal(page.focused, null);
    assert.equal(page.waiting, false);
  }
});
test('source capture keeps other history state and ignores modifier clicks', () => {
  const page = mount();
  const click = { button: 0, target: { closest: () => page.card } };
  page.context.scrollY = 2700;
  page.emit('click', { ...click, metaKey: true });
  assert.equal(page.history.state.homeReturn.source, 'hero');
  page.emit('click', click);
  assert.equal(page.history.state.other, 'preserve');
  assert.equal(page.history.state.homeReturn.source, 'catalog');
  assert.equal(page.history.state.homeReturn.offset, 150);
});
