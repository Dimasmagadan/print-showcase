import { holds, motionEligible, readRedesignManifest, redesignState } from './robot-cat-redesign-state.ts';
import { RedesignFramePool } from './robot-cat-redesign-pool.ts';
import { recordRobotCatMemory } from './robot-cat-memory.mjs';

/** Enhances a complete HTML story; native scrolling is the only playback clock. */
export function initRedesign(root: HTMLElement, env: Window & typeof globalThis = window) {
  const scene=root.querySelector<HTMLElement>('.story-scene')!;
  const canvas=root.querySelector<HTMLCanvasElement>('canvas')!;
  const beats=[...root.querySelectorAll<HTMLElement>('[data-story-key]')];
  const stage=root.querySelector<HTMLElement>('.story-stage')!;
  const ctx=canvas.getContext('2d');
  if(!ctx || !env.createImageBitmap || !env.fetch || !env.matchMedia) return;
  const reduced=env.matchMedia('(prefers-reduced-motion: reduce)');
  let layoutBlocked=false;
  let active=false, failed=false, disposed=false, suspended=false, raf=0, epoch=0, direction=1, lastFrame=-1;
  let data: ReturnType<typeof readRedesignManifest> | undefined;
  let loading=false, manifestAbort: AbortController | undefined, desired=0, desiredKey=0;
  const manifestURL=new URL(root.dataset.manifest!,env.location.href);
  const entryMatch=new URL(env.location.href).hash.match(/^#robot-key-([0-7])$/);
  const navigation=env.performance?.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  let entryKey=entryMatch && navigation?.type!=='back_forward' ? Number(entryMatch[1]) : null;
  const url=(i:number)=>new URL(data!.frames[i],manifestURL).href;
  const eligible=()=>!layoutBlocked && motionEligible(env.innerWidth,env.innerHeight,reduced.matches,parseFloat(env.getComputedStyle(env.document.documentElement).fontSize));
  const progress=()=>Math.max(0,Math.min(1,-scene.getBoundingClientRect().top/Math.max(1,scene.offsetHeight-stage.offsetHeight)));
  function visibleKey() {
    if(!active && entryKey!==null)return entryKey;
    if(active) { const s=redesignState(progress());return s.t>.5?s.next:s.key; }
    let nearest=0, distance=Infinity;
    beats.forEach((b,i)=>{const r=b.getBoundingClientRect();if(r.height===0)return;const d=Math.abs(r.top-env.innerHeight*.2);if(d<distance){nearest=i;distance=d}});
    return nearest;
  }
  function fallback(preferredKey?: number) {
    const was=active, key=preferredKey ?? visibleKey(), bounds=scene.getBoundingClientRect();
    epoch++; loading=false; manifestAbort?.abort(); pool.clear(); active=false;
    delete root.dataset.motion;
    for(const b of beats) { b.style.removeProperty('opacity');b.querySelector?.<HTMLElement>('h2')?.style.removeProperty('scroll-margin-top'); }
    canvas.hidden=true;
    // Preserve the stage being read when scroll distance collapses.
    if(was && bounds.top<=0 && bounds.bottom>0) {
      env.scrollTo({top:env.scrollY+beats[key].getBoundingClientRect().top-32,behavior:'instant'});
    }
  }
  function fail() {
    failed=true;
    const key=visibleKey();
    const poster=beats[key]?.querySelector?.('img');
    if(active && poster && typeof poster.decode==='function') {
      // Keep the last drawn pose and its copy until the static image is ready.
      pool.clear();poster.loading='eager';
      void poster.decode().catch(()=>{}).finally(()=>{if(!disposed)fallback(key)});
    } else fallback(key);
  }
  const pool=new RedesignFramePool({fetch:env.fetch.bind(env),decode:env.createImageBitmap.bind(env)},1600,1000,invalidate,fail,bytes=>recordRobotCatMemory(root,'story',bytes));
  recordRobotCatMemory(root,'story',0);
  function invalidate(){if(!raf&&!disposed&&!suspended)raf=env.requestAnimationFrame(draw)}
  function fits() {
    const space=root.querySelector<HTMLElement>('.story-space');
    if(!space)return true;
    return !beats.some((beat,i)=>{
      if(i===2)return false;
      const box=beat.querySelector<HTMLElement>('.beat-copy');
      return box && (box.offsetTop+box.offsetHeight>space.clientHeight-20 || box.offsetLeft+box.offsetWidth>space.clientWidth-20 || box.offsetTop<0);
    });
  }
  function activate(key:number) {
    const bounds=scene.getBoundingClientRect();
    const reading=entryKey!==null || bounds.top<env.innerHeight*.25 && bounds.bottom>0;
    root.dataset.motion=''; active=true;
    if(!fits()){
      layoutBlocked=true;active=false;delete root.dataset.motion;pool.clear();
      root.dataset.staticReason='text-fit';return;
    }
    delete root.dataset.staticReason;canvas.hidden=false;entryKey=null;
    for(const beat of beats) {
      const heading=beat.querySelector?.<HTMLElement>('h2');
      if(heading)heading.style.scrollMarginTop=`${heading.offsetTop+(beat.querySelector<HTMLElement>('.beat-copy')?.offsetTop??0)}px`;
    }
    if(reading) {
      const p=(holds[key][0]+holds[key][1])/2;
      env.scrollTo({top:env.scrollY+scene.getBoundingClientRect().top+p*(scene.offsetHeight-stage.offsetHeight),behavior:'instant'});
    }
  }
  function paint(frame:number) {
    const bitmap=pool.get(url(frame));
    if(!bitmap)return false;
    ctx!.drawImage(bitmap as CanvasImageSource,0,0);
    canvas.dataset.frame=String(frame);
    root.dataset.peakBytes=String(pool.peakBytes);root.dataset.peakRequests=String(pool.peakRequests);
    lastFrame=frame;return true;
  }
  async function prepare() {
    if(loading||data)return;
    loading=true;const generation=epoch;
    manifestAbort=new AbortController();
    try {
      const r=await env.fetch(manifestURL,{signal:manifestAbort.signal});
      if(!r.ok)throw Error('Manifest unavailable');
      const parsed=readRedesignManifest(await r.json());
      if(generation!==epoch||!eligible()||disposed||suspended)return;
      data=parsed;invalidate();
    }catch{if(generation===epoch&&!manifestAbort.signal.aborted)fail()}
    finally{if(generation===epoch)loading=false}
  }
  function draw() {
    raf=0;if(disposed||suspended||failed)return;
    if(!eligible()){if(active||loading||pool.pending.size)fallback();return}
    const playground=root.querySelector<HTMLElement>('#robot-playground');
    if(playground && (playground.getBoundingClientRect().top < env.innerHeight+300 || playground.querySelector?.('.playground-editor:not([hidden])'))) { pool.clear(); return; }
    const r=scene.getBoundingClientRect();
    if(r.top>env.innerHeight*1.5||r.bottom< -env.innerHeight){pool.clear();return}
    const handoff: { waits: Promise<void>[] } = { waits: [] };
    if(root.dispatchEvent) root.dispatchEvent(new CustomEvent('robot-story-prepare', { detail: handoff }));
    if(handoff.waits.length) { void Promise.all(handoff.waits).then(invalidate); return; }
    if(!data){void prepare();return}
    if(!active){desiredKey=visibleKey();desired=desiredKey*12;if(paint(desired))activate(desiredKey)}
    const state=active?redesignState(progress()):null;
    const frame=state?.frame??desired;
    direction=lastFrame<0||frame>=lastFrame?1:-1;
    const neighbors=[frame];
    for(let i=1;i<=4;i++)for(const n of [frame+i*direction,frame-i*direction])if(n>=0&&n<85)neighbors.push(n);
    pool.plan(neighbors.map(url));
    // Retain both the last painted pose and its matching explanation on slow loads.
    if(active&&paint(frame)&&state){
      root.dataset.key=String(state.key);
      beats.forEach((beat,i)=>beat.style.opacity=String(i===state.copy?Math.max(0,(state.opacity-.4)/.6):0));
      for(const annotation of root.querySelectorAll<HTMLElement>('[data-annotation]')){
        annotation.style.opacity=String(Number(annotation.dataset.annotation)===state.copy?Math.min(1,state.opacity*2):0);
      }
    }
  }
  const resize=()=>{
    layoutBlocked=false;
    if(active && (!eligible() || !fits())) {
      const textFit=eligible();fallback();
      if(textFit){layoutBlocked=true;root.dataset.staticReason='text-fit'}
    }
    invalidate();
  };
  const hashchange=()=>{
    const match=new URL(env.location.href).hash.match(/^#robot-key-([0-7])$/);
    if(match && active){
      const key=Number(match[1]),p=(holds[key][0]+holds[key][1])/2;
      env.scrollTo({top:env.scrollY+scene.getBoundingClientRect().top+p*(scene.offsetHeight-stage.offsetHeight),behavior:'instant'});
    }
    invalidate();
  };
  const pagehide=()=>{suspended=true;epoch++;manifestAbort?.abort();loading=false;pool.clear();if(raf)env.cancelAnimationFrame(raf);raf=0};
  const pageshow=()=>{suspended=false;invalidate()};
  const playgroundPrepare=(event: Event)=>{ (event as CustomEvent<{ waits: Promise<void>[] }>).detail.waits.push(pool.drain()); };
  root.addEventListener?.('robot-playground-prepare',playgroundPrepare);
  env.addEventListener('scroll',invalidate,{passive:true});env.addEventListener('resize',resize);
  env.addEventListener('hashchange',hashchange);env.addEventListener('pagehide',pagehide);env.addEventListener('pageshow',pageshow);reduced.addEventListener('change',resize);
  invalidate();
  return {pool,dispose(){disposed=true;root.removeEventListener?.('robot-playground-prepare',playgroundPrepare);pagehide();env.removeEventListener('scroll',invalidate);env.removeEventListener('resize',resize);env.removeEventListener('hashchange',hashchange);env.removeEventListener('pagehide',pagehide);env.removeEventListener('pageshow',pageshow);reduced.removeEventListener('change',resize)}};
}
