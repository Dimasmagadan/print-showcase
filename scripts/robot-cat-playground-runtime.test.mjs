import test from 'node:test';
import assert from 'node:assert/strict';
import { initPlayground } from '../src/scripts/robot-cat-playground.mjs';

class Element {
  constructor(dataset = {}) { this.dataset = dataset; this.hidden = false; this.style = {}; this.attrs = {}; this.listeners = {}; this.clientWidth = 500; this.captured = new Set(); }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  fire(type, event = {}) { for (const cb of this.listeners[type] || []) cb({ target: this, ...event }); }
  setAttribute(name, value) { this.attrs[name] = value; }
  hasAttribute(name) { return name === 'data-retry' && this.dataset.retry !== undefined; }
  closest() { return this; }
  focus() { document.activeElement = this; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 500, height: 500 }; }
}
function context() {
  return { strokes: 0, clearRect() { this.strokes = 0; }, save(){}, restore(){}, beginPath(){}, rect(){}, clip(){}, moveTo(){}, lineTo(){}, stroke(){ this.strokes++; }, translate(){}, transform(){}, drawImage(bitmap){ this.last = bitmap?.url; } };
}
function setup({ reduced = true, initialFailure = false } = {}) {
  const original = Object.fromEntries(['window', 'document', 'Image', 'IntersectionObserver', 'matchMedia', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'fetch', 'createImageBitmap'].map(k => [k, globalThis[k]]));
  const app = new Element({ media: '/media/' }), fallback = new Element(), root = new Element(), story = new Element(), nodes = new Map();
  story.dispatchEvent = event => story.fire(event.type, { detail: event.detail });
  for (const key of ['[data-image]', '[data-stage]', '[data-model]', '.playground-editor', '[data-editor-canvas]', '[data-art]', '[data-body-options]', '[data-action="editor"]', '[data-action="explode"]', '[data-action="done"]', '.playground-roll', '[data-cart-copy]', '[data-description]', '[data-extra]', '[data-live]', '.playground-error']) nodes.set(key, new Element());
  const editorContext = context(), artContext = context(), sceneContext = context();
  nodes.get('[data-image]').getContext = () => sceneContext;
  nodes.get('[data-editor-canvas]').getContext = () => editorContext;
  nodes.get('[data-art]').getContext = () => artContext;
  const select = (type, value) => new Element({ select: type, value });
  const choices = [select('head', 'cat'), select('head', 'duck'), select('body', 'tail'), select('body', 'plain'), select('mode', 'robot'), select('mode', 'cart')];
  app.querySelector = key => nodes.get(key);
  app.querySelectorAll = key => key === '[data-select]' ? choices : [];
  nodes.get('.playground-editor').querySelectorAll = () => [];
  const intro = new Element(), fallbackIntro = new Element(), copy = new Element(), initialError = new Element(), initialRetry = new Element({ initialRetry:'' });
  app.hidden = true; initialError.hidden = true;
  root.closest = () => story;
  root.querySelector = key => ({ '.playground-app': app, '.playground-fallback': fallback, '[data-playground-intro]': intro, '[data-playground-fallback-intro]': fallbackIntro, '[data-initial-error]': initialError, '[data-initial-retry]': initialRetry })[key];
  globalThis.document = new Element(); document.querySelector = () => copy;
  globalThis.window = new Element(); window.IntersectionObserver = true; window.createImageBitmap = true;
  globalThis.matchMedia = () => ({ matches: reduced, addEventListener(){} });
  globalThis.getComputedStyle = () => ({ borderLeftWidth: '0px' });
  let nextFrame = 0; const frames = new Map();
  globalThis.requestAnimationFrame = callback => { const id = ++nextFrame; frames.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  let timeOrigin = performance.now();
  const step = (offset = 1000) => { const pending = [...frames.values()]; frames.clear(); for (const cb of pending) cb(timeOrigin + offset); };
  const finish = () => { step(0); step(1000); };
  let failed = initialFailure ? 'cat-robot-tail.webp' : null, blocked = null, releaseBlocked = null;
  let live = 0, peak = 0;
  globalThis.fetch = async url => {
    if (blocked && url.includes(blocked)) await new Promise(resolve => { releaseBlocked = resolve; });
    return { ok: !url.includes(failed || '\0'), blob: async () => ({ url }) };
  };
  globalThis.createImageBitmap = async blob => {
    live++; peak = Math.max(peak, live);
    return { width: 640, height: 640, url: blob.url, close() { live--; } };
  };
  let observer;
  globalThis.IntersectionObserver = class { constructor(cb) { this.cb = cb; observer = this; } observe() { this.cb([{ isIntersecting: true }]); } disconnect() {} };
  const intersect = value => observer.cb([{ isIntersecting: value }]);
  initPlayground(root);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const click = element => app.fire('click', { target: element });
  const action = value => new Element({ action: value });
  const restore = () => { for (const [key, value] of Object.entries(original)) value === undefined ? delete globalThis[key] : globalThis[key] = value; };
  return { app, fallback, nodes, choices, editorContext, sceneContext, click, action, flush, step, finish, intersect, story, root, initialError, initialRetry, restore, counts: () => ({ live, peak }), block: value => { blocked = value; }, unblock: () => { blocked = null; releaseBlocked?.(); }, fail: value => { failed = value; } };
}

test('controller preserves template drawing through body, head and cart changes and undo restores clear', async () => {
  const h = setup();
  try {
    await h.flush();
    assert.equal(h.app.hidden, false); assert.equal(h.fallback.hidden, true);
    h.click(h.action('editor'));
    assert.equal(h.nodes.get('.playground-editor').hidden, false);
    h.click(new Element({ template: 'star' }));
    assert.equal(h.editorContext.strokes, 1);
    h.click(h.action('clear')); assert.equal(h.editorContext.strokes, 0);
    h.click(h.action('undo')); assert.equal(h.editorContext.strokes, 1);
    h.click(h.action('done'));
    h.click(h.choices[3]); await h.flush();
    h.click(h.choices[1]); await h.flush();
    h.click(h.choices[5]); await h.flush();
    assert.equal(h.nodes.get('[data-body-options]').hidden, true);
    h.click(h.choices[4]); await h.flush();
    assert.equal(h.choices[3].attrs['aria-pressed'], 'true');
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /Утка, робот без хвоста/);
    h.click(h.action('editor'));
    assert.equal(h.editorContext.strokes, 1);
  } finally { h.restore(); }
});

test('controller leaves vertical gestures alone, clamps horizontal drag and handles cancellation', async () => {
  const h = setup();
  try {
    await h.flush(); h.click(h.choices[5]); await h.flush();
    const stage = h.nodes.get('[data-stage]'), model = h.nodes.get('[data-model]');
    stage.fire('pointerdown', { button:0, pointerId:1, clientX:100, clientY:100 });
    stage.fire('pointermove', { pointerId:1, clientX:105, clientY:140 });
    assert.equal(stage.hasPointerCapture(1), false);
    assert.match(model.style.transform, /translateX\(0%\)/);
    stage.fire('pointercancel', { pointerId:1 });
    stage.fire('pointerdown', { button:0, pointerId:2, clientX:100, clientY:100 });
    stage.fire('pointermove', { pointerId:2, clientX:1000, clientY:101 });
    assert.equal(stage.hasPointerCapture(2), true);
    assert.match(model.style.transform, /translateX\(18%\)/);
    stage.fire('pointercancel', { pointerId:2 });
    h.click(h.choices[1]); await h.flush();
    assert.match(model.style.transform, /translateX\(0%\)/);
  } finally { h.restore(); }
});

test('media failure leaves old selection visible and retry commits it', async () => {
  const h = setup();
  try {
    await h.flush(); h.fail('duck-robot-tail.webp'); h.click(h.choices[1]); await h.flush();
    assert.equal(h.nodes.get('.playground-error').hidden, false);
    assert.equal(h.choices[0].attrs['aria-pressed'], 'true');
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /Кот/);
    h.fail(null); h.click(new Element({ retry: '' })); await h.flush();
    assert.equal(h.nodes.get('.playground-error').hidden, true);
    assert.equal(h.choices[1].attrs['aria-pressed'], 'true');
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /Утка/);
  } finally { h.restore(); }
});

test('latest rapid choice wins and editor cancels an unfinished pointer stroke', async () => {
  const h = setup();
  try {
    await h.flush();
    h.click(h.choices[1]); h.click(h.choices[0]); await h.flush(); await h.flush();
    assert.equal(h.choices[0].attrs['aria-pressed'], 'true');
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /Кот/);
    const opener = h.action('editor'); document.activeElement = opener; h.click(opener);
    const canvas = h.nodes.get('[data-editor-canvas]');
    canvas.fire('pointerdown', { button:0, pointerId:3, clientX:100, clientY:100 });
    assert.equal(h.editorContext.strokes, 1);
    canvas.fire('pointercancel', { pointerId:3 });
    assert.equal(h.editorContext.strokes, 0);
    h.click(h.action('done'));
    assert.equal(document.activeElement, opener);
  } finally { h.restore(); }
});

test('retry restores the complete pending variant after multiple quick choices', async () => {
  const h = setup();
  try {
    await h.flush(); h.fail('duck-robot-plain.webp');
    h.click(h.choices[1]); h.click(h.choices[3]); await h.flush(); await h.flush();
    assert.equal(h.nodes.get('.playground-error').hidden, false);
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /Кот/);
    h.fail(null); h.click(new Element({ retry:'' })); await h.flush();
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /Утка, робот без хвоста/);
    assert.equal(h.choices[1].attrs['aria-pressed'], 'true');
    assert.equal(h.choices[3].attrs['aria-pressed'], 'true');
  } finally { h.restore(); }
});


test('interrupted animated loads release decoded frames and stay within the frame budget', async () => {
  const h = setup({ reduced: false });
  try {
    await h.flush();
    h.click(h.choices[5]); await h.flush();
    assert.equal(h.counts().live, 18);
    h.click(h.choices[1]); await h.flush();
    assert.ok(h.counts().live <= 8);
    h.finish(); await h.flush();
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /Утка, голова на тележке/);
    assert.equal(h.counts().live, 4);
    h.click(h.choices[4]); await h.flush(); h.finish(); await h.flush();
    assert.equal(h.counts().live, 1);
    assert.ok(h.counts().peak <= 18);
    assert.ok(Number(h.app.dataset.peakDecodedBytes) <= 18 * 640 * 640 * 4);
  } finally { h.restore(); }
});


test('returning to the story releases playground frames and re-entry restores the current assembly', async () => {
  const h = setup();
  try {
    await h.flush(); h.click(h.choices[5]); await h.flush();
    assert.equal(h.counts().live, 1);
    h.intersect(false); h.story.fire('robot-story-prepare', { detail: { waits: [] } });
    assert.equal(h.counts().live, 0);
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /голова на тележке/);
    h.intersect(true); await h.flush();
    assert.equal(h.counts().live, 1);
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /голова на тележке/);
  } finally { h.restore(); }
});


test('visible new head and selected controls change together during animation', async () => {
  const h = setup({ reduced:false });
  try {
    await h.flush(); h.click(h.choices[1]); await h.flush();
    h.step(0); h.step(310);
    assert.match(h.sceneContext.last, /motion-duck-robot-tail-lift/);
    assert.equal(h.choices[1].attrs['aria-pressed'], 'true');
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /Утка/);
    h.click(h.action('editor')); await h.flush();
    assert.equal(h.nodes.get('.playground-editor').hidden, false);
    assert.match(h.sceneContext.last, /duck-robot-tail.webp/);
    assert.equal(h.counts().live, 1);
  } finally { h.restore(); }
});


test('story handoff retains the painted scene and resumes the pending selection on return', async () => {
  const h = setup();
  try {
    await h.flush();
    h.block('duck-robot-tail.webp'); h.click(h.choices[1]); await h.flush();
    h.intersect(false);
    const detail = { waits: [] }; h.story.fire('robot-story-prepare', { detail });
    assert.equal(detail.waits.length, 1);
    let settled = false; const handoff = Promise.all(detail.waits).then(() => { settled = true; });
    await h.flush(); assert.equal(settled, false);
    assert.match(h.sceneContext.last, /cat-robot-tail.webp/);
    h.unblock(); await handoff; await h.flush();
    assert.equal(h.counts().live, 0);
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /Кот/);
    h.intersect(true); await h.flush();
    assert.equal(h.counts().live, 1);
    assert.match(h.sceneContext.last, /duck-robot-tail.webp/);
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /Утка/);
  } finally { h.restore(); }
});


test('page cache return resumes a selection interrupted by pagehide', async () => {
  const h = setup();
  try {
    await h.flush(); h.block('duck-robot-tail.webp');
    h.click(h.choices[1]); await h.flush(); window.fire('pagehide');
    assert.match(h.sceneContext.last, /cat-robot-tail.webp/);
    h.unblock(); await h.flush(); window.fire('pageshow'); await h.flush();
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /Утка/);
  } finally { h.restore(); }
});

test('mode transition exposes cart controls when the cart enters and an interruption keeps that assembly', async () => {
  const h = setup({ reduced:false });
  try {
    await h.flush(); h.click(h.choices[5]); await h.flush(); h.step(0); h.step(330);
    assert.match(h.sceneContext.last, /support-cat-tail-cart/);
    assert.equal(h.choices[5].attrs['aria-pressed'], 'true');
    assert.equal(h.nodes.get('[data-body-options]').hidden, true);
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /голова на тележке/);
    h.click(h.action('explode')); await h.flush(); h.finish(); await h.flush();
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /соединения показаны/);
    assert.equal(h.nodes.get('.playground-roll').hidden, true);
  } finally { h.restore(); }
});


test('a visible body choice is remembered while a cart selection is still loading', async () => {
  const h = setup();
  try {
    await h.flush(); h.block('cat-cart-tail.webp');
    h.click(h.choices[5]); await h.flush();
    assert.equal(h.nodes.get('[data-body-options]').hidden, false);
    h.click(h.choices[3]); h.unblock(); await h.flush(); await h.flush();
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /голова на тележке/);
    h.click(h.choices[4]); await h.flush();
    assert.equal(h.choices[3].attrs['aria-pressed'], 'true');
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /без хвоста/);
  } finally { h.restore(); }
});


test('story handoff restores a stable scene when it interrupts an animation', async () => {
  const h = setup({ reduced:false });
  try {
    await h.flush(); h.click(h.choices[5]); await h.flush(); h.step(0); h.step(220);
    assert.notEqual(h.nodes.get('[data-model]').style.transform, 'scale(1.15)');
    h.intersect(false); h.story.fire('robot-story-prepare', { detail:{ waits:[] } });
    assert.equal(h.nodes.get('[data-model]').style.transform, 'scale(1.15)');
    assert.equal(h.nodes.get('[data-art]').style.transform, '');
    assert.match(h.sceneContext.last, /cat-robot-tail.webp/);
    assert.equal(h.counts().live, 0);
  } finally { h.restore(); }
});


test('an earlier animation timestamp keeps the first frame and does not stall', async () => {
  const h = setup({ reduced:false });
  try {
    await h.flush(); h.click(h.choices[1]); await h.flush();
    h.step(-100);
    assert.match(h.sceneContext.last, /motion-cat-robot-tail-lift-1/);
    h.finish(); await h.flush();
    assert.match(h.nodes.get('[data-stage]').attrs['aria-label'], /Утка/);
  } finally { h.restore(); }
});


test('initial media failure keeps the fallback and retry activates it with focus', async () => {
  const h=setup({initialFailure:true});
  try {
    await h.flush();
    assert.equal(h.app.hidden,true); assert.equal(h.fallback.hidden,false); assert.equal(h.initialError.hidden,false);
    h.root.fire('click',{target:h.initialRetry}); await h.flush();
    assert.equal(document.activeElement,h.initialRetry); assert.equal(h.initialError.hidden,false);
    h.fail(null); h.root.fire('click',{target:h.initialRetry}); await h.flush();
    assert.equal(h.app.hidden,false); assert.equal(h.fallback.hidden,true); assert.equal(h.initialError.hidden,true);
    assert.equal(document.activeElement,h.nodes.get('[data-stage]'));
  } finally { h.restore(); }
});
