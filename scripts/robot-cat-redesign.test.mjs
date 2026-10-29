import {test} from 'node:test';
import assert from 'node:assert/strict';
import {redesignState, holds, motionEligible, frameCapacity, readRedesignManifest} from '../src/scripts/robot-cat-redesign-state.ts';
test('all reading holds freeze physical state; reverse and deep entry select the same frame',()=>{
  for(let k=0;k<holds.length;k++){
    const [a,b]=holds[k];
    for(const p of [a,(a+b)/2,b]) assert.equal(redesignState(p).frame,k*12);
  }
  const p=Array.from({length:1001},(_,i)=>i/1000);
  const forward=p.map(n=>redesignState(n));
  assert.deepEqual(p.reverse().map(n=>redesignState(n)).reverse(),forward);
  assert.equal(redesignState(NaN).frame,0);
  assert.equal(redesignState(Infinity).frame,84);
  for(let i=1;i<forward.length;i++) assert(forward[i].frame>=forward[i-1].frame);
});
test('new-head copy never anticipates the reveal and all ordinary transitions hide copy',()=>{
  for(let i=761;i<840;i++) assert.equal(redesignState(i/1000).copy,null);
  assert.equal(redesignState(.85).copy,6);
  assert.equal(redesignState(.95).copy,7);
  for(const p of [.09,.24,.35,.55,.68]) assert.equal(redesignState(p).copy,null);
});
test('eligibility and memory capacity derive from dimensions, including decode reservations',()=>{
  assert(motionEligible(1024,768,false));
  for(const args of [[1023,900,false],[1440,699,false],[1440,900,true],[1440,900,false,24]]) assert(!motionEligible(...args));
  assert.equal(frameCapacity(1600,1000),7);
  assert.equal(frameCapacity(1920,1080),6);
  assert(frameCapacity(1600,1000)*1600*1000*4<=64*1024*1024);
});
test('manifest validates sizes, count, bytes and local ordered paths',()=>{
 const d={version:2,width:1600,height:1000,framesPerTransition:12,frames:Array.from({length:85},(_,i)=>`frames/${String(i).padStart(3,'0')}.webp`),bytes:Array(85).fill(100),totalBytes:8500};
 assert.equal(readRedesignManifest(d),d);
 for(const patch of [{width:800},{frames:['../model.stl']},{totalBytes:1},{bytes:[]},{framesPerTransition:6}]) assert.throws(()=>readRedesignManifest({...d,...patch}));
});

import {RedesignFramePool} from '../src/scripts/robot-cat-redesign-pool.ts';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('raster pool stays under 64 MiB including delayed decodes and under three requests',async()=>{
 let live=0, peak=0, requests=0;
 const pool=new RedesignFramePool({fetch:async url=>{requests++;await tick();return {ok:true,blob:async()=>url}},decode:async()=>{live++;peak=Math.max(peak,live);await tick();return {width:1600,height:1000,close(){live--}}}},1600,1000,()=>{},()=>assert.fail());
 for(let j=0;j<5;j++){
  pool.plan(Array.from({length:14},(_,i)=>`${j*10+i}`));
  for(let i=0;i<25;i++) await tick();
  assert(pool.bytes<=64*1024*1024);
 }
 assert(pool.peakRequests<=3);assert(pool.peakBytes<=64*1024*1024);assert(peak<=7);
 const settled=requests;for(let i=0;i<10;i++)await tick();assert.equal(requests,settled);
 pool.clear();assert.equal(live,0);
});
test('pool cancels stale decodes, and failure clears work without dropping the painted canvas',async()=>{
 let resolve, ready=0,closed=0,failures=0;
 const pool=new RedesignFramePool({fetch:async url=>({ok:url!=='bad',blob:async()=>url}),decode:()=>new Promise(r=>resolve=r)},1600,1000,()=>ready++,()=>{failures++;pool.clear()});
 pool.plan(['old']);await tick();pool.clear();
 resolve({width:1600,height:1000,close(){closed++}});await tick();
 assert.equal(ready,0);assert.equal(closed,1);assert.equal(pool.reservations,0);
 pool.plan(['bad']);await tick();assert.equal(failures,1);assert.equal(pool.pending.size,0);
});

import {initRedesign} from '../src/scripts/robot-cat-redesign.ts';
function runtime({width=1440, badManifest=false, badFrame=false, hash=''}={}) {
 const listeners=new Map(),queued=new Map(),requests=[];let y=0,id=0;
 const root={dataset:{manifest:'/base/media/robot-cat-story/v2/manifest.json'}};
 const style=()=>({removeProperty(k){delete this[k]}});
 const beats=Array.from({length:8},(_,k)=>({style:style(),getBoundingClientRect:()=>({top:1000+k*700-y})}));
 const scene={getBoundingClientRect:()=>({top:1000-y,bottom:1000+scene.offsetHeight-y}),get offsetHeight(){return root.dataset.motion!==undefined?6300:5600}};
 const stage={offsetHeight:900};const painted=[];
 const canvas={hidden:true,dataset:{},getContext:()=>({drawImage:b=>painted.push(b)})};
 root.querySelector=s=>({'.story-scene':scene,'.story-stage':stage,'canvas':canvas})[s];
 root.querySelectorAll=s=>s==='[data-story-key]'?beats:[];
 const listen=(k,f)=>listeners.set(k,[...(listeners.get(k)||[]),f]);
 const unlisten=(k,f)=>listeners.set(k,(listeners.get(k)||[]).filter(v=>v!==f));
 const media={matches:false,addEventListener:(k,f)=>listen('media',f),removeEventListener:(k,f)=>unlisten('media',f)};
 const data={version:2,width:1600,height:1000,framesPerTransition:12,frames:Array.from({length:85},(_,i)=>`frames/${String(i).padStart(3,'0')}.webp`),bytes:Array(85).fill(100),totalBytes:8500};
 const env={innerWidth:width,innerHeight:900,document:{documentElement:{}},get scrollY(){return y},location:{href:'http://localhost/base/models/robot-cat/'+hash},getComputedStyle:()=>({fontSize:'16px'}),matchMedia:()=>media,
 requestAnimationFrame:f=>{queued.set(++id,f);return id},cancelAnimationFrame:i=>queued.delete(i),addEventListener:listen,removeEventListener:unlisten,scrollTo:({top})=>{y=top},
 fetch:async(url,options)=>{url=String(url);requests.push({url,signal:options.signal});return {ok:url.endsWith('.json')?!badManifest:!badFrame,json:async()=>data,blob:async()=>url}},
 createImageBitmap:async()=>({width:1600,height:1000,close(){}})};
 const controller=initRedesign(root,env);
 const emit=k=>(listeners.get(k)||[]).forEach(f=>f());
 return {root,canvas,requests,painted,beats,controller,env,media,emit,scroll(n){y=n;emit('scroll')},async flush(){for(let i=0;i<8;i++){const callbacks=[...queued.values()];queued.clear();callbacks.forEach(f=>f());await tick()}}};
}
test('flow mode never requests sequences; failed manifest/frame keeps the full story available',async()=>{
 const small=runtime({width:390});await small.flush();assert.equal(small.requests.length,0);assert.equal(small.root.dataset.motion,undefined);small.controller.dispose();
 for(const failure of [{badManifest:true},{badFrame:true}]) {
  const h=runtime(failure);await h.flush();assert.equal(h.root.dataset.motion,undefined);assert(h.canvas.hidden);assert(h.beats.every(b=>b.style.opacity===undefined));h.controller.dispose();
 }
});
test('real unified controller paints deep entry/reverse and collapses scroll distance to the same reading stage on resize',async()=>{
 const h=runtime();await h.flush();assert.equal(h.root.dataset.motion,'');assert.equal(h.canvas.dataset.frame,'0');
 h.scroll(1000+5400*.95);await h.flush();assert.equal(h.canvas.dataset.frame,'84');
 h.scroll(1000+5400*.44);await h.flush();assert.equal(h.canvas.dataset.frame,'36');
 h.env.innerWidth=390;h.emit('resize');await h.flush();assert.equal(h.root.dataset.motion,undefined);assert.equal(h.env.scrollY,1000+3*700-32);
 assert(h.requests.every(r=>r.url.startsWith('http://localhost/base/media/robot-cat-story/v2/')));
 const n=h.requests.length;h.controller.dispose();h.scroll(2000);await h.flush();assert.equal(h.requests.length,n);
});
test('resize to an eligible but unreadable composition switches to flow at the current stage',async()=>{
 const h=runtime();await h.flush();h.scroll(1000+5400*.44);await h.flush();
 const original=h.root.querySelector;
 h.root.querySelector=s=>s==='.story-space'?{clientHeight:640,clientWidth:1024}:original(s);
 for(const beat of h.beats)beat.querySelector=selector=>selector==='.beat-copy'?({offsetTop:90,offsetHeight:680,offsetLeft:50,offsetWidth:276}):undefined;
 h.env.innerWidth=1024;h.emit('resize');await h.flush();
 assert.equal(h.root.dataset.motion,undefined);assert.equal(h.root.dataset.staticReason,'text-fit');assert.equal(h.env.scrollY,1000+3*700-32);h.controller.dispose();
});

test('fresh semantic deep entry selects and positions the requested stage before enhancement',async()=>{
 const h=runtime({hash:'#robot-key-4'});await h.flush();assert.equal(h.canvas.dataset.frame,'48');assert.equal(h.root.dataset.key,'4');assert(Math.abs(h.env.scrollY-(1000+.62*5400))<1);h.controller.dispose();
});

test('reveal copy fades from scroll position after the head is visible and leaves a gap before K7',()=>{
 assert.equal(redesignState(.83).copy,null);
 assert.equal(redesignState(.842).copy,6);assert(Math.abs(redesignState(.842).opacity-.5)<1e-9);
 assert.equal(redesignState(.85).opacity,1);assert.equal(redesignState(.88).copy,6);
 assert.equal(redesignState(.895).copy,null);assert.equal(redesignState(.905).copy,7);
});


import sharp from 'sharp';
import {assertVisiblePLA} from './robot-cat-redesign-media.mjs';
test('media gate rejects dark silhouettes even when dimensions and WebP decoding are valid',async()=>{
 const input={create:{width:1600,height:1000,channels:3,background:'#0d0d12'}};
 const dark=await sharp(input).webp().toBuffer();
 await assert.rejects(assertVisiblePLA(dark,'failed render'),/visible light PLA missing/);
 const visible=await sharp(input).composite([{input:Buffer.from('<svg width="1600" height="1000"><rect x="700" y="300" width="200" height="400" fill="#e0dfd8"/></svg>')}]).webp().toBuffer();
 assert(await assertVisiblePLA(visible)>70_000);
});

test('handoff waits for aborted requests and in-progress decodes before playground media starts', async () => {
  let finishDecode, closed = 0, drained = false;
  const pool = new RedesignFramePool({
    fetch: async () => ({ ok:true, blob:async () => 'frame' }),
    decode: () => new Promise(resolve => { finishDecode = resolve; }),
  }, 1600, 1000, () => assert.fail('stale frame became visible'), () => assert.fail());
  pool.plan(['frame']); await tick();
  const drain = pool.drain().then(() => { drained = true; });
  await tick(); assert.equal(drained, false);
  finishDecode({ width:1600, height:1000, close() { closed++; } });
  await drain;
  assert.equal(closed, 1); assert.equal(pool.pending.size, 0); assert.equal(pool.bytes, 0);
});

test('story accounting includes pending decode reservations and returns to zero after drain', async () => {
  let finish; const accounted=[];
  const pool=new RedesignFramePool({fetch:async()=>({ok:true,blob:async()=>null}),decode:()=>new Promise(resolve=>{finish=resolve})},1600,1000,()=>{},()=>assert.fail(),bytes=>accounted.push(bytes));
  pool.plan(['frame']); await tick();
  assert.equal(accounted.at(-1), 1600*1000*4);
  const done=pool.drain(); finish({width:1600,height:1000,close(){}}); await done;
  assert.equal(accounted.at(-1),0);
});
