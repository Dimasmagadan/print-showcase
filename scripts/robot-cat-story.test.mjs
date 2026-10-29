import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, stat, readdir } from 'node:fs/promises';
import { storyState, storyProgress, readSequence } from '../src/scripts/robot-cat-story-state.ts';
import { StoryFramePool, initRobotCatStory } from '../src/scripts/robot-cat-story.ts';

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const bitmap = (id, close = () => {}) => ({ id, width: 800, height: 1000, close });
const response = url => ({ ok: true, blob: async () => url });

test('split endpoints, interval edges and long reading holds are reversible for arbitrary counts', () => {
  for (const count of [2, 17, 40, 60, 91]) {
    for (const p of [-Infinity, -1, 0, .15, .83, 1, 2, Infinity]) assert.equal(storyState('split', p, count).frame, 0);
    for (const p of [.32, .4, .5, .65]) assert.equal(storyState('split', p, count).frame, count - 1);
    const positions = Array.from({ length: 201 }, (_, i) => i / 200);
    const forward = positions.map(p => storyState('split', p, count).frame);
    assert.deepEqual(positions.reverse().map(p => storyState('split', p, count).frame).reverse(), forward);
    assert(Math.abs(storyState('split', (.15 + .32) / 2, count).frame - (count - 1) / 2) <= .500001);
  }
});

test('swap holds both ends, is monotone and clamps malformed progress/count safely', () => {
  for (const p of [-1, 0, .18]) assert.equal(storyState('swap', p, 40).frame, 0);
  for (const p of [.65, .8, 1, Infinity]) assert.equal(storyState('swap', p, 40).frame, 39);
  let previous = 0;
  for (let i = 0; i <= 1000; i++) {
    const frame = storyState('swap', i / 1000, 73).frame;
    assert(frame >= previous && frame <= 72); previous = frame;
  }
  assert.equal(storyState('swap', NaN, 40).frame, 0);
  for (const count of [0, -1, NaN, Infinity]) assert.equal(storyState('swap', 1, count).frame, 0);
});

test('progress uses wrapper edges and stays finite for zero/negative ranges', () => {
  assert.equal(storyProgress(968, 1000, 3025, 32, 836), 0);
  assert.equal(storyProgress(2157, 1000, 3025, 32, 836), 1);
  assert.equal(storyProgress((968 + 2157) / 2, 1000, 3025, 32, 836), .5);
  assert.equal(storyProgress(100, 100, 100, 0, 0), 0);
  assert.equal(storyProgress(101, 100, 100, 0, 1000), 1);
});

test('stale decode cannot announce readiness or replace the new desired frame', async () => {
  const decodes = new Map(), ready = [], closed = [];
  const pool = new StoryFramePool({ fetch: async url => response(url), decode: url => { const d = deferred(); decodes.set(url, d); return d.promise; }, controller: () => new AbortController() });
  pool.plan('split', ['old'], () => ready.push('old'), () => assert.fail());
  await tick();
  pool.plan('split', ['new'], () => ready.push('new'), () => assert.fail());
  await tick();
  decodes.get('new').resolve(bitmap('new', () => closed.push('new')));
  await tick();
  decodes.get('old').resolve(bitmap('old', () => closed.push('old')));
  await tick();
  assert.deepEqual(ready, ['new']); assert.deepEqual(closed, ['old']);
  assert.equal(pool.get('new').id, 'new'); assert.equal(pool.get('old'), undefined);
  pool.clear(); assert.deepEqual(closed, ['old', 'new']);
});

test('global request/bitmap limits, LRU closure and two-chapter prefetch converge without looping', async () => {
  let live = 0, peak = 0, maxPending = 0, requests = 0, ready = 0, closed = 0;
  const pool = new StoryFramePool({
    fetch: async url => { requests++; await tick(); maxPending = Math.max(maxPending, pool.pending.size); return response(url); },
    decode: async url => { live++; peak = Math.max(peak, live); return bitmap(url, () => { live--; closed++; }); }, controller: () => new AbortController(),
  });
  const plan = (name, offset) => pool.plan(name, Array.from({ length: 5 }, (_, i) => name + (offset + i)), () => ready++, () => assert.fail());
  plan('split', 0); plan('swap', 0);
  for (let i = 0; i < 20; i++) await tick();
  assert.equal(requests, 8); assert.equal(ready, 8); assert.equal(pool.cache.size, 8);
  assert(maxPending <= 3); assert(peak <= 8);
  plan('split', 20);
  for (let i = 0; i < 20; i++) await tick();
  assert(peak <= 8); assert(closed > 0); assert(pool.cache.size <= 8);
  const settled = requests; for (let i = 0; i < 5; i++) await tick(); assert.equal(requests, settled);
  pool.clear(); assert.equal(live, 0);
});

test('clear during decode closes stale bitmaps; old requests still occupy concurrency slots until settled', async () => {
  const decoding = [], signals = []; let shown = 0, closed = 0;
  const pool = new StoryFramePool({ fetch: async (url, options) => { signals.push(options.signal); return response(url); }, decode: () => { const d = deferred(); decoding.push(d); return d.promise; }, controller: () => new AbortController() });
  pool.plan('split', ['a', 'b', 'c', 'd'], () => shown++, () => assert.fail());
  await tick(); assert.equal(decoding.length, 3);
  pool.clear(); assert(signals.every(s => s.aborted));
  pool.plan('swap', ['x'], () => shown++, () => assert.fail());
  assert.equal(pool.pending.size, 3);
  for (const d of decoding.slice()) d.resolve(bitmap('stale', () => closed++));
  await tick(); assert.equal(closed, 3); assert.equal(shown, 0);
  decoding[3].resolve(bitmap('x', () => closed++));
  await tick(); assert.equal(shown, 1); pool.clear(); assert.equal(closed, 4);
});

test('404 and decode failures stop their chapter, while the other owner still loads', async () => {
  for (const failure of ['fetch', 'decode']) {
    let errors = 0, ready = 0;
    const pool = new StoryFramePool({ fetch: async url => url === 'bad' && failure === 'fetch' ? { ok: false } : response(url), decode: async url => { if (url === 'bad') throw Error('decode'); return bitmap(url); }, controller: () => new AbortController() });
    pool.plan('split', ['bad'], () => assert.fail(), () => { errors++; pool.remove('split'); });
    pool.plan('swap', ['good'], () => ready++, () => assert.fail());
    await tick(); assert.equal(errors, 1); assert.equal(ready, 1); assert.equal(pool.plans.has('split'), false);
    pool.clear();
  }
});

function mount({ motion = true, supported = true, rootPresent = true, manifestFailure = false, frameFailure = false, holdDecode = false, holdManifest = false, posterFailure = false } = {}) {
  const listeners = new Map(), frames = new Map(), requests = [], painted = [], decoded = [];
  let serial = 0, mode = motion, y = 0, closes = 0;
  const listen = (type, callback) => listeners.set(type, [...(listeners.get(type) ?? []), callback]);
  const unlisten = (type, callback) => listeners.set(type, (listeners.get(type) ?? []).filter(c => c !== callback));
  const canvases = ['split', 'swap'].map(sequence => ({ hidden: true, dataset: {}, getContext: () => ({ drawImage: image => painted.push([sequence, image.id]) }) }));
  const wrappers = [2000, 7000].map(top => ({ getBoundingClientRect: () => ({ top: top - y, bottom: top + 2025 - y }) }));
  const visuals = wrappers.map(() => ({ getBoundingClientRect: () => ({ height: 836 }) }));
  const chapters = wrappers.map((wrapper, i) => ({ dataset: { sequence: i ? 'swap' : 'split' }, querySelector: selector => ({ '.story-visual-wrapper': wrapper, '.story-visual': visuals[i], 'canvas': canvases[i] })[selector] }));
  const posters = ['cat', 'bunny'].map(name => ({ dataset: { poster: name }, hidden: false, parentElement: { setAttribute() {} }, querySelector: () => ({ naturalWidth: 800, decode: async () => { if (posterFailure) throw Error('poster'); } }) }));
  const choices = { hidden: true };
  const buttons = ['cat', 'bunny'].map(name => ({ dataset: { variant: name }, attrs: {}, handlers: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(type, callback) { this.handlers[type] = callback; } }));
  const root = { dataset: { manifest: '/base/media/robot-cat-story/v1/manifest.json' }, querySelector: () => choices, querySelectorAll: selector => ({ '[data-sequence]': chapters, '[data-poster]': posters, '[data-variant]': buttons })[selector] };
  const manifest = { version: 1, width: 800, height: 1000, totalBytes: 8000, sequences: Object.fromEntries(['split', 'swap'].map(name => [name, { count: 40, frames: Array.from({ length: 40 }, (_, i) => `${name}/${String(i).padStart(3, '0')}.webp`), bytes: Array(40).fill(100), totalBytes: 4000 }])) };
  const media = { matches: false, addEventListener: (type, callback) => listen('media', callback), removeEventListener: (type, callback) => unlisten('media', callback) };
  const manifestGate = deferred();
  const env = {
    innerHeight: 900, get scrollY() { return y; }, location: { href: 'http://localhost/base/models/robot-cat/' }, AbortController,
    getComputedStyle: element => ({ top: '32px', getPropertyValue: () => mode ? '1' : '0' }), matchMedia: () => media,
    requestAnimationFrame: callback => { frames.set(++serial, callback); return serial; }, cancelAnimationFrame: id => frames.delete(id),
    addEventListener: listen, removeEventListener: unlisten,
    fetch: async (url, options) => { requests.push({ url, signal: options.signal }); if (url.endsWith('.json')) { if (holdManifest) await manifestGate.promise; return { ok: !manifestFailure, json: async () => manifest }; } return { ok: !frameFailure, blob: async () => url }; },
    createImageBitmap: supported ? async url => { if (holdDecode) { const d = deferred(); decoded.push({ ...d, url }); return d.promise; } return bitmap(url, () => closes++); } : undefined,
  };
  const controller = initRobotCatStory(rootPresent ? root : null, env);
  const emit = type => { for (const callback of listeners.get(type) ?? []) callback({ persisted: true }); };
  return { controller, requests, painted, decoded, canvases, frames, listeners, choices, buttons, posters, media, manifestGate,
    mode(value) { mode = value; emit('resize'); },
    scroll(value) { y = value; emit('scroll'); }, emit,
    frame() { const batch = [...frames.values()]; frames.clear(); batch.forEach(callback => callback()); },
    get closes() { return closes; },
  };
}

test('absent root and unsupported bitmap API cause no story requests or handlers', () => {
  for (const options of [{ rootPresent: false }, { supported: false }]) {
    const h = mount(options); assert.equal(h.requests.length, 0); assert.equal(h.listeners.size, 0);
  }
});

test('static mode never fetches frames; comparison initializes and works independently', async () => {
  const h = mount({ motion: false }); await tick();
  h.emit('pageshow'); h.emit('pageshow'); h.scroll(3000); h.frame(); await tick();
  assert.equal(h.requests.length, 0); assert.equal(h.frames.size, 0);
  assert.equal(h.choices.hidden, false); assert.equal(h.posters[1].hidden, true);
  h.buttons[1].handlers.click(); assert.equal(h.posters[0].hidden, true); assert.equal(h.posters[1].hidden, false);
  assert.equal(h.buttons[1].attrs['aria-pressed'], 'true');
  h.controller.dispose();
});

test('poster decode failure preserves both labelled images and keeps unavailable controls hidden', async () => {
  const h = mount({ motion: false, posterFailure: true }); await tick();
  assert.equal(h.choices.hidden, true); assert(h.posters.every(p => !p.hidden));
  assert(h.buttons.every(b => Object.keys(b.handlers).length === 0));
  h.controller.dispose();
});

test('disable or pagehide before manifest completion aborts and ignores the late response', async () => {
  for (const trigger of ['resize', 'pagehide']) {
    const h = mount({ holdManifest: true }); h.scroll(2500); h.frame(); await tick();
    assert.equal(h.requests.length, 1);
    if (trigger === 'resize') h.mode(false); else h.emit('pagehide');
    assert.equal(h.requests[0].signal.aborted, true);
    h.manifestGate.resolve(); await tick(); h.frame();
    assert.equal(h.requests.length, 1); assert.equal(h.painted.length, 0);
    h.mode(true); h.emit('pageshow'); h.frame(); await tick(); h.frame(); await tick(); h.frame();
    assert.equal(h.canvases[0].dataset.frame, '39');
    h.controller.dispose();
  }
});

test('real controller reverses both sequences and performs no animation work after dispose', async () => {
  const h = mount();
  for (const [scroll, sequence, expected] of [[1968, 0, '0'], [2563, 0, '39'], [3157, 0, '0'], [2563, 0, '39'], [1968, 0, '0'], [6968, 1, '0'], [8157, 1, '39'], [6968, 1, '0']]) {
    h.scroll(scroll); h.frame(); await tick(); h.frame(); await tick(); h.frame();
    assert.equal(h.canvases[sequence].dataset.frame, expected);
  }
  h.controller.dispose(); h.scroll(3000); h.emit('resize'); h.emit('pageshow');
  assert.equal(h.frames.size, 0);
  assert.equal([...h.listeners.values()].flat().length, 0);
});

test('manifest and sequences load near their own chapters; decode schedules a still frame without a scroll event', async () => {
  const h = mount(); h.frame(); await tick(); assert.equal(h.requests.length, 0);
  h.scroll(1300); h.frame(); await tick(); assert.equal(h.requests.length, 1);
  h.frame(); await tick(); assert(h.requests.length > 1); assert(h.requests.every(r => !r.url.includes('/swap/')));
  h.frame(); assert.equal(h.canvases[0].hidden, false); assert(h.painted.length > 0);
  const count = h.painted.length; h.frame(); assert.equal(h.painted.length, count);
  h.scroll(6500); h.frame(); await tick(); h.frame(); await tick(); h.frame();
  assert(h.requests.some(r => r.url.includes('/swap/'))); assert.equal(h.canvases[1].hidden, false);
  assert(h.requests.every(r => r.url.startsWith('http://localhost/base/media/')));
  h.controller.dispose();
});

test('rapid seek paints the current frame when an older decode resolves later', async () => {
  const h = mount({ holdDecode: true }); h.scroll(2000); h.frame(); await tick(); h.frame(); await tick();
  const old = h.decoded[0]; assert(old);
  h.scroll(2580); h.frame(); await tick();
  // Three old decodes occupy all slots. Free a neighbour while keeping the
  // previous desired frame pending, then let the new desired finish first.
  h.decoded[1].resolve(bitmap(h.decoded[1].url)); await tick();
  const fresh = h.decoded.find(d => d.url.endsWith('039.webp')); assert(fresh);
  fresh.resolve(bitmap(fresh.url)); await tick(); h.frame();
  assert.equal(h.canvases[0].dataset.frame, '39');
  let closed = false; old.resolve(bitmap(old.url, () => { closed = true; })); await tick(); h.frame();
  assert.equal(h.canvases[0].dataset.frame, '39'); assert(closed);
  h.controller.dispose();
  for (const d of h.decoded) d.resolve(bitmap(d.url)); await tick();
});

test('manifest/frame errors retain poster and disable only that chapter for the visit', async () => {
  for (const options of [{ manifestFailure: true }, { frameFailure: true }]) {
    const h = mount(options); h.scroll(2500); h.frame(); await tick(); h.frame(); await tick(); h.frame();
    const count = h.requests.length;
    for (let i = 0; i < 4; i++) { h.scroll(2500 + i); h.frame(); await tick(); }
    assert.equal(h.requests.length, count); assert.equal(h.canvases[0].hidden, true);
    assert.equal(h.choices.hidden, false); h.controller.dispose();
  }
});

test('disable/pagehide invalidate loading; pageshow reuses one controller and seeks native restored position', async () => {
  for (const trigger of ['resize', 'pagehide', 'media']) {
    const h = mount({ holdDecode: true }); h.scroll(2500); h.frame(); await tick(); h.frame(); await tick();
    const stale = h.decoded.slice(); assert(stale.length > 0);
    if (trigger === 'resize') h.mode(false);
    else if (trigger === 'media') { h.media.matches = true; h.emit('media'); }
    else h.emit('pagehide');
    assert.equal(h.frames.size, 0);
    let closed = 0; stale.forEach(d => d.resolve(bitmap(d.url, () => closed++))); await tick();
    assert.equal(closed, stale.length); assert.equal(h.canvases[0].hidden, true);
    h.media.matches = false; h.mode(true); h.emit('pageshow'); h.emit('pageshow');
    assert.equal(h.frames.size, 1);
    assert([...h.listeners.values()].every(callbacks => callbacks.length === 1));
    h.frame(); await tick(); h.frame(); await tick();
    const fresh = h.decoded.slice(stale.length); assert(fresh.length > 0);
    fresh.forEach(d => d.resolve(bitmap(d.url))); await tick(); h.frame();
    assert.equal(h.canvases[0].dataset.frame, '39');
    h.controller.dispose(); for (const d of h.decoded) d.resolve(bitmap(d.url)); await tick();
  }
});

test('manifest frames are safe, complete, dimensionally correct and within the media budget', async () => {
  const root = new URL('../public/media/robot-cat-story/v1/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  let total = 0;
  for (const name of Object.keys(manifest.sequences)) {
    const frames = readSequence(manifest, name);
    assert([40, 60].includes(frames.length));
    let bytes = 0;
    for (const [i, frame] of frames.entries()) {
      const data = await readFile(new URL(frame, root));
      assert.equal(data.length, manifest.sequences[name].bytes[i]);
      assert.equal(data.toString('ascii', 0, 4), 'RIFF'); assert.equal(data.toString('ascii', 8, 12), 'WEBP');
      // Lossy VP8 image header stores 14-bit dimensions at offsets 26/28.
      assert.equal(data.toString('ascii', 12, 16), 'VP8 ');
      assert.equal(data.readUInt16LE(26) & 0x3fff, 800); assert.equal(data.readUInt16LE(28) & 0x3fff, 1000);
      bytes += data.length;
    }
    assert.equal(bytes, manifest.sequences[name].totalBytes); total += bytes;
  }
  assert.equal(total, manifest.totalBytes); assert(total <= 6_000_000);
  const corrupted = structuredClone(manifest); corrupted.sequences.split.frames[0] = '../escape.webp';
  assert.throws(() => readSequence(corrupted, 'split'));
  for (const bad of ['/split/000.webp', 'https://other.test/000.webp', 'split/%2e%2e/000.webp', 'swap/000.webp']) {
    const corrupted = structuredClone(manifest); corrupted.sequences.split.frames[0] = bad;
    assert.throws(() => readSequence(corrupted, 'split'));
  }
  for (const path of await readdir(new URL('../src/assets/robot-cat-story/', import.meta.url))) assert((await stat(new URL('../src/assets/robot-cat-story/' + path, import.meta.url))).size <= 180_000);
  if (manifest.sequences.swap) assert.deepEqual(await readFile(new URL('split/000.webp', root)), await readFile(new URL('swap/000.webp', root)));
  for (const [poster, frame] of [['assembled-cat', 'split/000.webp'], ['exploded-cat', 'split/' + String(manifest.sequences.split.count - 1).padStart(3, '0') + '.webp'], ['assembled-bunny', 'swap/' + String(manifest.sequences.swap.count - 1).padStart(3, '0') + '.webp']]) {
    assert.deepEqual(await readFile(new URL('../src/assets/robot-cat-story/' + poster + '.webp', import.meta.url)), await readFile(new URL(frame, root)));
  }
});
