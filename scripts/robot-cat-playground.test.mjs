import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, transition, createSelectionLoader, gestureDirection, createLatestQueue, motionFrames, wheelPhase, releaseVelocity, ROBOT_SCALE, CART_SCALE } from '../src/scripts/robot-cat-playground-state.mjs';

test('mode and head changes preserve body, drawing and the documented assembly rules', () => {
  let s = initialState();
  s = transition(s, { type: 'body', value: 'plain' });
  s = transition(s, { type: 'editor', open: true });
  s = transition(s, { type: 'draw', stroke: { shape: 'heart' } });
  s = transition(s, { type: 'mode', value: 'cart' });
  assert.equal(s.editor, false);
  assert.equal(s.body, 'plain');
  s = transition(s, { type: 'move', position: 3, velocity: 2 });
  assert.equal(s.position, 1);
  assert.equal(transition(s, { type: 'move', position: NaN }).position, 1);
  s = transition(s, { type: 'explode' });
  s = transition(s, { type: 'head', value: 'duck' });
  assert.equal(s.exploded, true);
  assert.equal(s.position, 0);
  s = transition(s, { type: 'mode', value: 'robot' });
  assert.equal(s.exploded, false);
  assert.equal(s.body, 'plain');
  assert.deepEqual(s.drawing, [{ shape: 'heart' }]);
});

test('clear is undoable and history is bounded', () => {
  let s = transition(initialState(), { type: 'editor', open: true });
  for (let i = 0; i < 25; i++) s = transition(s, { type: 'draw', stroke: i });
  assert.equal(s.undo.length, 20);
  s = transition(s, { type: 'clear' });
  s = transition(s, { type: 'undo' });
  assert.equal(s.drawing.length, 25);
});

test('only the latest decoded selection commits, and stale failures are ignored', async () => {
  const pending = new Map(), commits = [], failures = [];
  const loader = createSelectionLoader(a => new Promise((resolve, reject) => pending.set(a.value, { resolve, reject })), a => commits.push(a.value), a => failures.push(a.value));
  const first = loader.select({ value: 'cat' });
  const second = loader.select({ value: 'duck' });
  pending.get('duck').resolve();
  await second;
  pending.get('cat').reject(new Error('late'));
  await first;
  assert.deepEqual(commits, ['duck']);
  assert.deepEqual(failures, []);
});

test('gesture classification leaves vertical scroll alone', () => {
  assert.equal(gestureDirection(2, 3), 'pending');
  assert.equal(gestureDirection(4, 20), 'vertical');
  assert.equal(gestureDirection(-20, 4), 'horizontal');
});


test('media queue limits in-flight work and skips intermediate selections', async () => {
  const pending = [], started = [];
  const request = createLatestQueue(value => new Promise(resolve => { started.push(value); pending.push(resolve); }));
  const a = request('cat'), b = request('duck'), c = request('dog');
  assert.deepEqual(started, ['cat']);
  assert.equal(await b, null);
  pending.shift()('cat loaded');
  assert.equal(await a, 'cat loaded');
  await Promise.resolve();
  assert.deepEqual(started, ['cat', 'dog']);
  pending.shift()('dog loaded');
  assert.equal(await c, 'dog loaded');
});


test('assembly frames keep each mode separate and reverse the exploded sequence', () => {
  for (const mode of ['robot', 'cart']) for (const body of ['tail', 'plain']) {
    const old = { ...initialState(), mode, body };
    const exploded = transition(old, { type: 'explode' });
    const forward = motionFrames(old, exploded, { type: 'explode' });
    assert.equal(forward.length, 3);
    assert.deepEqual(motionFrames(exploded, old, { type: 'explode' }), [...forward].reverse());
    assert.ok(forward.every(f => f.includes(`-${mode}-`)));
    assert.deepEqual(motionFrames(old, exploded, { type: 'explode' }, true), []);
  }
  const robot = initialState(), plain = transition(robot, { type: 'body', value: 'plain' }), cart = transition(robot, { type: 'mode', value: 'cart' });
  assert.equal(motionFrames(robot, plain, { type: 'body' }).length, 6);
  const swap = motionFrames(robot, cart, { type: 'mode' });
  assert.equal(swap.length, 13);
  assert.ok(swap.slice(0, 6).every(f => f.includes('-robot-')));
  assert.match(swap[6], /-head\.webp$/);
  assert.ok(swap.slice(7).every(f => f.includes('-cart-')));
  assert.deepEqual(motionFrames(cart, robot, { type: 'mode' }), [...swap].reverse());
});

test('wheel phase changes with travelled distance in opposite directions', () => {
  assert.equal(wheelPhase(0), 0);
  assert.equal(wheelPhase(.6), 3);
  assert.equal(wheelPhase(-.6), 1);
});

test('all playable assemblies and motion frames exist within the raster budget', async () => {
  const { readdir, stat, readFile } = await import('node:fs/promises');
  const { gzipSync } = await import('node:zlib');
  const sharp = (await import('sharp')).default;
  const dir = 'public/media/robot-cat-playground';
  const files = await readdir(dir);
  let total = 0;
  for (const file of files) {
    assert.match(file, /\.webp$/);
    total += (await stat(`${dir}/${file}`)).size;
    const meta = await sharp(`${dir}/${file}`).metadata();
    assert.equal(meta.format, 'webp');
    if (file !== 'heads.webp') { assert.equal(meta.width, 640); assert.equal(meta.height, 640); }
  }
  const first = await Promise.all(['cat-robot-tail.webp', 'cat-cart-tail.webp', 'heads.webp'].map(file => stat(`${dir}/${file}`)));
  assert.ok(first.reduce((sum, item) => sum + item.size, 0) < 1024 * 1024);
  assert.ok(total < 5 * 1024 * 1024, `${total} bytes`);
  for (const head of ['cat', 'bunny', 'duck', 'dog']) for (const mode of ['robot', 'cart']) for (const body of mode === 'cart' ? ['tail'] : ['tail', 'plain']) {
    const state = { ...initialState(), head, mode, body };
    for (const suffix of ['', '-exploded']) {
      const file = `${head}-${mode}-${body}${suffix}.webp`;
      const { data, info } = await sharp(`${dir}/${file}`).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
      assert.equal(info.width, 640); assert.equal(info.height, 640);
      let minX=640, maxX=-1, minY=640, maxY=-1;
      for (let y=0; y<640; y++) for (let x=0; x<640; x++) if (data[(y*640+x)*4+3]>16) {
        minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y);
      }
      assert.ok(minX>16 && maxX<624 && minY>16 && maxY<624, `${file}: cropped at ${minX},${minY}–${maxX},${maxY}`);
      assert.ok((minX+maxX)/2>250 && (minX+maxX)/2<390, `${file}: subject shifted horizontally`);
      const scale = mode === 'cart' ? CART_SCALE : ROBOT_SCALE;
      const shift = mode === 'cart' ? 640*.18 : 0;
      assert.ok(320+(minX-320)*scale-shift>0 && 320+(maxX-320)*scale+shift<640, `${file}: leaves the scene at travel limit`);
      assert.ok(320+(minY-320)*scale>0 && 320+(maxY-320)*scale<640, `${file}: vertical crop at scene zoom`);
    }
    for (const kind of ['lift', 'explode']) for (let i = 1; i <= 3; i++) {
      const file = `motion-${head}-${mode}-${body}-${kind}-${i}.webp`;
      assert.ok(files.includes(file), file);
    }
    if (mode === 'cart') for (let i = 1; i <= 3; i++) assert.ok(files.includes(`motion-${head}-cart-wheel-${i}.webp`));
  }
  for (const head of ['cat', 'bunny', 'duck', 'dog']) {
    assert.ok(files.includes(`support-${head}-head.webp`));
    for (const body of ['tail', 'plain']) for (const mode of ['robot', 'cart']) for (let i=1; i<=3; i++) assert.ok(files.includes(`support-${head}-${body}-${mode}-${i}.webp`));
  }
  for (const head of ['cat', 'bunny', 'duck', 'dog']) for (const body of ['tail', 'plain']) for (let i=1; i<=3; i++) assert.ok(files.includes(`body-${head}-${body}-${i}.webp`));
  const sources = await Promise.all(['src/scripts/robot-cat-playground.mjs', 'src/scripts/robot-cat-playground-state.mjs'].map(p => readFile(p)));
  assert.ok(gzipSync(Buffer.concat(sources)).length < 30 * 1024);
});

test('planned decoded raster working set leaves room for the story canvas and posters', () => {
  const playgroundFrames = 18 * 640 * 640 * 4;
  const playgroundCanvases = (2 * 800 * 800 + 500 * 500) * 4;
  const storyCanvasAndTwoPosters = 3 * 1600 * 1000 * 4;
  const fallbackAndThumbs = (640 * 640 + 500 * 170) * 4;
  assert.ok(playgroundFrames + playgroundCanvases + storyCanvasAndTwoPosters + fallbackAndThumbs < 64 * 1024 * 1024);
});

test('queue drain waits for the active request and discards waiting work', async () => {
  let finish, drained = false;
  const queue = createLatestQueue(() => new Promise(resolve => { finish = resolve; }));
  const first = queue('first'), stale = queue('stale');
  const drain = queue.drain().then(() => { drained = true; });
  assert.equal(await stale, null); assert.equal(drained, false);
  finish('decoded'); assert.equal(await first, 'decoded'); await drain;
  assert.equal(drained, true); assert.equal(queue.busy(), false);
});


test('a pause before releasing the cart removes stale fling velocity', () => {
  assert.equal(releaseVelocity(3, 0), 2);
  assert.ok(releaseVelocity(2, 400) < .02);
  assert.equal(releaseVelocity(NaN, 0), 0);
});

test('new media choices abort an obsolete network request before loading the latest', async () => {
  const started = [], aborted = [];
  const queue = createLatestQueue((value, signal) => new Promise((resolve, reject) => {
    started.push(value);
    signal.addEventListener('abort', () => { aborted.push(value); reject(new Error('aborted')); });
    if (value === 'latest') resolve(value);
  }));
  const old = queue('old').catch(() => null);
  const latest = queue('latest');
  assert.equal(await old, null);
  assert.equal(await latest, 'latest');
  assert.deepEqual(started, ['old', 'latest']);
  assert.deepEqual(aborted, ['old']);
});

test('cart wheel phases contain visible changes in the wheel region', async () => {
  const sharp = (await import('sharp')).default;
  const area = { left:328, top:380, width:80, height:152 };
  const dir = 'public/media/robot-cat-playground';
  const frames = await Promise.all(['cat-cart-tail.webp', 'motion-cat-cart-wheel-1.webp'].map(file => sharp(`${dir}/${file}`).extract(area).ensureAlpha().raw().toBuffer()));
  let changed = 0;
  for (let i=0; i<frames[0].length; i+=4) {
    if (Math.abs(frames[0][i]-frames[1][i]) + Math.abs(frames[0][i+1]-frames[1][i+1]) + Math.abs(frames[0][i+2]-frames[1][i+2]) > 20) changed++;
  }
  assert.ok(changed > 100, `only ${changed} wheel pixels differ`);
});

test('shared accounting records combined live bytes and preserves the peak', async () => {
  const {recordRobotCatMemory}=await import('../src/scripts/robot-cat-memory.mjs');
  const root={dataset:{}};
  recordRobotCatMemory(root,'story',6400000);
  recordRobotCatMemory(root,'playground',1638400);
  assert.equal(Number(root.dataset.combinedPeakBytes),8038400);
  recordRobotCatMemory(root,'story',0);
  recordRobotCatMemory(root,'playground',0);
  assert.equal(Number(root.dataset.combinedAccountedBytes),0);
  assert.equal(Number(root.dataset.combinedPeakBytes),8038400);
});

test('lift and connection frames keep every head and support inside the zoomed scene', async () => {
  const sharp=(await import('sharp')).default, dir='public/media/robot-cat-playground';
  for (const head of ['cat','bunny','duck','dog']) for (const mode of ['robot','cart']) for (const body of mode==='cart'?['tail']:['tail','plain']) for (const kind of ['lift','explode']) for (let i=1;i<=3;i++) {
    const file=`motion-${head}-${mode}-${body}-${kind}-${i}.webp`;
    const data=await sharp(`${dir}/${file}`).ensureAlpha().raw().toBuffer();
    let minX=640,maxX=-1,minY=640,maxY=-1;
    for(let y=0;y<640;y++) for(let x=0;x<640;x++) if(data[(y*640+x)*4+3]>16) {
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
    const scale=mode==='cart'?CART_SCALE:ROBOT_SCALE;
    assert.ok(320+(minX-320)*scale>0 && 320+(maxX-320)*scale<640 && 320+(minY-320)*scale>0 && 320+(maxY-320)*scale<640,`${file}: crops at scene zoom`);
  }
});
