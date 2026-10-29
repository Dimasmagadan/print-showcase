import { recordRobotCatMemory } from './robot-cat-memory.mjs';
import { initialState, transition, gestureDirection, createLatestQueue, motionFrames, wheelPhase, releaseVelocity, ROBOT_SCALE, CART_SCALE, CART_TRAVEL_FRACTION } from './robot-cat-playground-state.mjs';

export function initPlayground(root) {
  const app = root.querySelector('.playground-app'), fallback = root.querySelector('.playground-fallback');
  if (!app || !fallback) return;
  const $ = selector => app.querySelector(selector);
  const image = $('[data-image]'), stage = $('[data-stage]'), model = $('[data-model]');
  const editor = $('.playground-editor'), editorCanvas = $('[data-editor-canvas]'), art = $('[data-art]');
  const ectx = editorCanvas.getContext('2d'), actx = art.getContext('2d'), sceneContext = image.getContext('2d');
  if (!ectx || !actx || !sceneContext || !('IntersectionObserver' in window) || !('createImageBitmap' in window)) return;
  const media = app.dataset.media;
  const storyRoot = root.closest?.('.robot-cat-story');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const labels = { cat: 'Кот', bunny: 'Заяц', duck: 'Утка', dog: 'Собака' };
  let state = initialState(), desired = state, revision = 0, failed = null, color = '#222222', eraser = false;
  let animation = 0, lastTime = 0, drag = null, stroke = null, opener = null, stableFrame = null, wheelFrames = [];
  let decodedBytes = 0, reservedBytes = 0, peakDecodedBytes = 0;
  const liveFrames = new Set();
  const maxDecodedBytes = 18 * 640 * 640 * 4;
  const publishMemory = () => recordRobotCatMemory(storyRoot, 'playground', decodedBytes + reservedBytes);
  publishMemory();
  let activeWork = null, resumeCandidate = null;
  const name = s => `${s.head}-${s.mode}-${s.mode === 'cart' ? 'tail' : s.body}${s.exploded ? '-exploded' : ''}.webp`;
  async function loadFile(file, signal) {
    const response = await fetch(media + file, { signal });
    if (!response.ok) throw Error('Media unavailable');
    const blob = await response.blob();
    const reservation = 640 * 640 * 4;
    if (decodedBytes + reservedBytes + reservation > maxDecodedBytes) throw Error('Decoded frame budget exceeded');
    reservedBytes += reservation;
    peakDecodedBytes = Math.max(peakDecodedBytes, decodedBytes + reservedBytes);
    app.dataset.peakDecodedBytes = String(peakDecodedBytes); publishMemory();
    let bitmap, reserved = true;
    try {
      bitmap = await createImageBitmap(blob);
      if (bitmap.width !== 640 || bitmap.height !== 640) { bitmap.close(); throw Error('Invalid media dimensions'); }
      reservedBytes -= reservation; reserved = false;
      liveFrames.add(bitmap); decodedBytes += reservation;
      app.dataset.decodedBytes = String(decodedBytes); publishMemory();
      return bitmap;
    } finally { if (reserved) { reservedBytes -= reservation; publishMemory(); } }
  }
  function release(bitmap) {
    if (!bitmap || !liveFrames.delete(bitmap)) return;
    decodedBytes -= bitmap.width * bitmap.height * 4; bitmap.close();
    app.dataset.decodedBytes = String(decodedBytes); publishMemory();
  }
  function cancelPending() {
    revision++;
    if (!activeWork) return;
    activeWork.cancel?.();
    if (activeWork.committed) updateControls(state, true);
    for (const bitmap of activeWork.temporary) release(bitmap);
    activeWork = null;
  }
  function show(bitmap) {
    if (!bitmap) return;
    sceneContext.clearRect(0, 0, 800, 800); sceneContext.drawImage(bitmap, 0, 0, 800, 800);
  }
  const loadLatest = createLatestQueue(loadFile);
  function description(s) {
    return `${labels[s.head]}, ${s.mode === 'cart' ? 'голова на тележке' : `робот ${s.body === 'tail' ? 'с хвостом' : 'без хвоста'}`}, ${s.exploded ? 'соединения показаны' : 'собран'}`;
  }
  function drawStrokes(ctx, strokes, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, size, size); ctx.clip();
    for (const item of strokes) {
      ctx.globalCompositeOperation = item.erase ? 'destination-out' : 'source-over';
      ctx.strokeStyle = item.color; ctx.lineWidth = size * (item.erase ? .09 : .025); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      item.points.forEach(([x,y], i) => i ? ctx.lineTo(x * size, y * size) : ctx.moveTo(x * size, y * size));
      if (item.points.length === 1) ctx.lineTo(item.points[0][0] * size + .01, item.points[0][1] * size);
      ctx.stroke();
    }
    ctx.restore();
  }
  function paint() {
    drawStrokes(ectx, stroke ? [...state.drawing, stroke] : state.drawing, 500);
    actx.clearRect(0, 0, 800, 800);
    {
      actx.save();
      // Projection of the inside of the front frame in the common orthographic camera.
      actx.translate(361.19, 455.792); actx.transform(57.886 / 500, 5.907 / 500, 0, 57.961 / 500, 0, 0);
      actx.drawImage(editorCanvas, 0, 0); actx.restore();
    }
  }
  function updateControls(view, announce = true) {
    app.querySelectorAll('[data-select]').forEach(button => button.setAttribute('aria-pressed', String(view[button.dataset.select] === button.dataset.value)));
    $('[data-body-options]').hidden = view.mode !== 'robot';
    $('[data-action="editor"]').hidden = view.mode !== 'robot';
    $('[data-action="explode"]').textContent = view.exploded ? 'Собрать обратно' : 'Как соединяется';
    $('.playground-roll').hidden = view.mode !== 'cart' || view.exploded;
    $('[data-cart-copy]').hidden = view.mode !== 'cart';
    $('[data-description]').textContent = view.mode === 'robot' ? 'Голова, корпус и ноги соединяются без клея. Руки и хвост — часть корпуса.' : 'На тележку ставится только голова. Колёса свободно вращаются на закреплённых осях.';
    $('[data-extra]').textContent = view.head === 'duck' ? 'Клюв напечатан отдельно и приклеивается к голове.' : view.head === 'dog' ? 'Нос напечатан отдельно и приклеивается к голове.' : '';
    stage.setAttribute('aria-label', description(view));
    stage.dataset.mode = view.mode;
    if (announce) $('[data-live]').textContent = description(view);
  }
  function render(announce = true) {
    updateControls(state, announce);
    if (state.mode === 'cart' && !state.exploded && wheelFrames.length === 4 && !reduced.matches) {
      const phase = wheelPhase(state.position);
      show(wheelFrames[phase]);
    }
    art.style.opacity = state.mode === 'robot' ? '1' : '0';
    art.style.transform = '';
    model.style.transform = state.mode === 'cart' ? `translateX(${state.position * CART_TRAVEL_FRACTION * 100}%) scale(${CART_SCALE})` : `scale(${ROBOT_SCALE})`;
    paint();
  }
  function stopMotion(center = false) {
    cancelAnimationFrame(animation); animation = 0; lastTime = 0;
    state = center ? { ...state, position: 0, velocity: 0 } : transition(state, { type: 'stop' });
  }
  async function select(action, retryState = null) {
    if (action.type !== 'restore') resumeCandidate = null;
    cancelPending();
    stopMotion(['head','mode','explode'].includes(action.type));
    if (['head','mode','explode'].includes(action.type)) desired = { ...desired, position: 0, velocity: 0 };
    render(false);
    if (action.type === 'mode' && state.editor) closeEditor();
    const visibleBodyChoice = action.type === 'body' && state.mode === 'robot' && desired.mode === 'cart';
    desired = retryState || transition(desired, visibleBodyChoice ? { ...action, allowDuringTransition:true } : action);
    const candidate = desired, previous = state, token = revision;
    if (stableFrame) show(stableFrame);
    art.style.transform = ''; art.style.opacity = state.mode === 'robot' ? '1' : '0';
    const temporary = new Set(), work = { temporary, cancel: null };
    activeWork = work;
    try {
      const src = await loadLatest(name(candidate));
      if (src) temporary.add(src);
      if (!src || token !== revision) return false;
      const files = motionFrames(state, candidate, action, reduced.matches);
      const frames = [];
      for (const file of files) {
        const frame = await loadLatest(file);
        if (frame) temporary.add(frame);
        if (!frame || token !== revision) return false;
        frames.push(frame);
      }
      const wheels = [src];
      if (candidate.mode === 'cart' && !candidate.exploded && !reduced.matches) {
        for (let i=1; i<=3; i++) {
          const frame = await loadLatest(`motion-${candidate.head}-cart-wheel-${i}.webp`);
          if (frame) temporary.add(frame);
          if (!frame || token !== revision) return false;
          wheels.push(frame);
        }
      }
      let committed = false;
      function commit() {
        if (committed) return;
        for (const old of new Set([stableFrame, ...wheelFrames])) release(old);
        stableFrame = src; wheelFrames = wheels;
        for (const retained of new Set(wheels)) temporary.delete(retained);
        state = candidate; desired = state; committed = true; work.committed = true;
        updateControls(state, false);
      }
      if (frames.length) {
        const duration = 560; let start = null;
        const finished = await new Promise(resolve => {
          let frameId = 0;
          work.cancel = () => { cancelAnimationFrame(frameId); resolve(false); };
          function frame(now) {
            if (token !== revision) return resolve(false);
            if (start === null) start = now;
            const progress = Math.max(0, Math.min(1, (now - start) / duration));
            if (progress === 1) return resolve(true);
            const index = Math.min(frames.length - 1, Math.floor(progress * frames.length));
            const switchAt = action.type === 'mode' ? 7 : (action.type === 'head' || action.type === 'body') ? 3 : Infinity;
            if (index >= switchAt) commit();
            show(frames[index]);
            if (action.type === 'body') {
              const body = files[index].match(/-(\d)\.webp$/);
              art.style.transform = body ? `translate(${-15.1 * Number(body[1])}%, ${-1.65 * Number(body[1])}%)` : '';
            }
            if (action.type === 'mode') {
              const zoom = previous.mode === 'robot' ? progress : 1 - progress;
              model.style.transform = `scale(${ROBOT_SCALE + (CART_SCALE - ROBOT_SCALE) * zoom})`;
              const file = files[index], robot = file.match(/-robot-(\d)\.webp$/);
              art.style.opacity = file.includes('-robot-') ? '1' : '0';
              art.style.transform = robot ? `translate(${-15.1 * Number(robot[1])}%, ${-1.65 * Number(robot[1])}%)` : '';
            }
            frameId = requestAnimationFrame(frame);
          }
          frameId = requestAnimationFrame(frame);
        });
        if (!finished || token !== revision) return false;
      }
      commit();
      show(src); failed = null;
      $('.playground-error').hidden = true; render(); return true;
    } catch {
      if (token !== revision) return false;
      show(stableFrame); failed = { action, candidate }; desired = state; $('.playground-error').hidden = false; return false;
    } finally {
      for (const bitmap of temporary) release(bitmap);
      if (activeWork === work) activeWork = null;
    }
  }
  function openEditor() {
    cancelPending(); desired = state; if (stableFrame) show(stableFrame); art.style.transform = ''; art.style.opacity = state.mode === 'robot' ? '1' : '0';
    opener = document.activeElement;
    state = transition(state, { type: 'editor', open: true }); desired = state;
    editor.hidden = false; paint(); $('[data-action="done"]').focus();
  }
  function closeEditor() {
    stroke = null; editor.hidden = true; state = transition(state, { type: 'editor', open: false }); desired = state;
    opener?.focus({ preventScroll: true }); render(false);
  }
  function point(event) {
    const r = editorCanvas.getBoundingClientRect();
    // Canvas border is outside its drawing box.
    const border = parseFloat(getComputedStyle(editorCanvas).borderLeftWidth) || 0;
    return [Math.max(0, Math.min(1, (event.clientX - r.left - border) / (r.width - 2 * border))), Math.max(0, Math.min(1, (event.clientY - r.top - border) / (r.height - 2 * border)))];
  }
  editorCanvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; editorCanvas.setPointerCapture(e.pointerId); stroke = { color, erase: eraser, points: [point(e)] }; paint(); });
  editorCanvas.addEventListener('pointermove', e => { if (stroke && editorCanvas.hasPointerCapture(e.pointerId)) { stroke.points.push(point(e)); paint(); } });
  editorCanvas.addEventListener('pointerup', e => { if (stroke && editorCanvas.hasPointerCapture(e.pointerId)) { stroke.points.push(point(e)); state = transition(state, { type: 'draw', stroke }); desired = state; stroke = null; paint(); } });
  editorCanvas.addEventListener('pointercancel', () => { stroke = null; paint(); });
  function template(kind) {
    const pts = [];
    if (kind === 'heart') for (let i = 0; i <= 100; i++) { const t = i * Math.PI * 2 / 100; pts.push([.5 + .021 * 16 * Math.sin(t)**3, .48 - .021 * (13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))]); }
    if (kind === 'star') for (let i = 0; i <= 10; i++) { const t = i * Math.PI / 5 - Math.PI/2, r = i % 2 ? .16 : .35; pts.push([.5 + r*Math.cos(t), .5 + r*Math.sin(t)]); }
    if (kind === 'smile') for (let i = 0; i <= 30; i++) { const t = Math.PI * i / 30; pts.push([.2 + .6*i/30, .4 + .25*Math.sin(t)]); }
    state = transition(state, { type: 'draw', stroke: { color, erase: false, points: pts } }); desired = state; paint();
  }
  function tick(time) {
    if (!lastTime) lastTime = time;
    const dt = Math.min((time - lastTime) / 1000, .05); lastTime = time;
    let pos = state.position + state.velocity * dt, velocity = state.velocity * Math.exp(-4 * dt);
    if (pos <= -1 || pos >= 1) { pos = Math.max(-1, Math.min(1, pos)); velocity = 0; }
    state = transition(state, { type: 'move', position: pos, velocity }); desired = state; render(false);
    if (Math.abs(velocity) > .01) animation = requestAnimationFrame(tick); else stopMotion();
  }
  function roll(direction) {
    cancelPending(); desired = state; if (stableFrame) show(stableFrame); art.style.transform = ''; art.style.opacity = state.mode === 'robot' ? '1' : '0';
    stopMotion();
    if (!direction) return;
    if (reduced.matches) { state = transition(state, { type: 'move', position: state.position + direction * .25 }); desired = state; render(false); }
    else { state = transition(state, { type: 'move', position: state.position, velocity: direction * 1.2 }); animation = requestAnimationFrame(tick); }
  }
  stage.addEventListener('pointerdown', e => { if (state.mode !== 'cart' || state.exploded || e.button !== 0) return; cancelPending(); desired = state; if (stableFrame) show(stableFrame); stopMotion(); drag = { id:e.pointerId, x:e.clientX, y:e.clientY, start:state.position, lastX:e.clientX, time:performance.now(), velocity:0, direction:'pending' }; });
  stage.addEventListener('pointermove', e => { if (!drag || drag.id !== e.pointerId) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; if (drag.direction === 'pending') drag.direction=gestureDirection(dx,dy); if (drag.direction !== 'horizontal') return; if (!stage.hasPointerCapture(e.pointerId)) stage.setPointerCapture(e.pointerId); const now=performance.now(), width=stage.clientWidth*CART_TRAVEL_FRACTION; drag.velocity=(e.clientX-drag.lastX)/width/Math.max(.001,(now-drag.time)/1000); drag.lastX=e.clientX; drag.time=now; state=transition(state,{type:'move',position:drag.start+dx/width}); desired=state; render(false); });
  stage.addEventListener('pointerup', e => { if (!drag || drag.id !== e.pointerId) return; const velocity=drag.direction === 'horizontal' ? releaseVelocity(drag.velocity, performance.now()-drag.time) : 0; drag=null; if (velocity && !reduced.matches) { state=transition(state,{type:'move',position:state.position,velocity}); animation=requestAnimationFrame(tick); } });
  stage.addEventListener('pointercancel', () => { drag=null; stopMotion(); });
  stage.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { if (state.mode !== 'cart' || state.exploded) return; e.preventDefault(); roll(e.key === 'ArrowLeft' ? -1 : 1); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { drag=null; stopMotion(); } });
  reduced.addEventListener('change', () => {
    cancelPending(); drag = null; stopMotion(); desired = state;
    if (stableFrame) show(stableFrame);
    render(false);
    if (!reduced.matches && state.mode === 'cart' && !state.exploded) void select({type:'mode', value:'cart'});
  });
  window.addEventListener('pagehide', () => {
    if (activeWork) resumeCandidate = desired;
    cancelPending(); drag = null; stopMotion(); desired = state;
    if (stableFrame) show(stableFrame); render(false);
  });
  window.addEventListener('pageshow', () => {
    if (resumeCandidate && nearby) {
      const target = resumeCandidate;
      void select({type:'restore'}, target).then(ok => { if (ok && resumeCandidate === target) resumeCandidate = null; });
    }
  });
  editor.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closeEditor(); } if (e.key === 'Tab') { const buttons=[...editor.querySelectorAll('button')], first=buttons[0], last=buttons.at(-1); if (e.shiftKey && document.activeElement===first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement===last) { e.preventDefault(); first.focus(); } } });
  app.addEventListener('click', e => {
    const button = e.target.closest('button'); if (!button) return;
    if (button.dataset.select) return void select({ type:button.dataset.select, value:button.dataset.value });
    if (button.dataset.roll !== undefined) return void roll(Number(button.dataset.roll));
    if (button.dataset.color) { color=button.dataset.color; eraser=false; app.querySelectorAll('[data-color],[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b===button))); return; }
    if (button.dataset.tool) { eraser=true; app.querySelectorAll('[data-color],[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b===button))); return; }
    if (button.dataset.template) return void template(button.dataset.template);
    if (button.hasAttribute('data-retry') && failed) return void select(failed.action, failed.candidate);
    switch (button.dataset.action) {
      case 'explode': select({type:'explode'}); break;
      case 'editor': if (state.exploded) { select({type:'explode'}).then(ok => { if (ok) openEditor(); }); } else openEditor(); break;
      case 'done': closeEditor(); break;
      case 'clear': case 'undo': state=transition(state,{type:button.dataset.action}); desired=state; paint(); break;
    }
  });
  let initialized = false, entering = false, nearby = false;
  function releaseForStory(event) {
    if (state.editor) return;
    if (activeWork) resumeCandidate = desired;
    cancelPending(); stopMotion(); desired = state;
    show(stableFrame);
    if (initialized) render(false);
    for (const bitmap of new Set([stableFrame, ...wheelFrames])) release(bitmap);
    stableFrame = null; wheelFrames = [];
    if (loadLatest.busy()) event.detail.waits.push(loadLatest.drain());
  }
  storyRoot?.addEventListener('robot-story-prepare', releaseForStory);
  async function enter(retry = false) {
    if (!nearby || entering || (initialized && stableFrame)) return;
    entering = true;
    const initialError = root.querySelector('[data-initial-error]');
    const initialRetry = root.querySelector('[data-initial-retry]');
    if (initialRetry) initialRetry.disabled = true;
    const startRevision = revision;
    try {
      const waits = [];
      storyRoot?.dispatchEvent(new CustomEvent('robot-playground-prepare', { detail: { waits } }));
      await Promise.all(waits);
      if (!nearby) return;
      if (initialized) {
        const target = resumeCandidate || state;
        if (await select({ type: 'restore' }, target)) resumeCandidate = null;
        return;
      }
      const initialRevision = revision;
      const bitmap = await loadLatest(name(state));
      if (!bitmap) return;
      if (!nearby || initialRevision !== revision) { release(bitmap); return; }
      stableFrame = bitmap; show(stableFrame); fallback.hidden = true; app.hidden = false; initialized = true;
      if (initialError) initialError.hidden = true;
      root.querySelector('[data-playground-intro]').hidden = false;
      root.querySelector('[data-playground-fallback-intro]').hidden = true;
      const copy = document.querySelector('[data-playground-paint-copy]'); if (copy) copy.hidden = false;
      render(false);
      if (retry) stage.focus({ preventScroll: true });
    } catch {
      // Keep the labelled fallback; a retry is offered only after JavaScript is ready.
      if (!initialized && nearby && startRevision === revision && initialError) initialError.hidden = false;
    } finally {
      if (initialRetry) {
        initialRetry.disabled = false;
        if (retry && !initialized && nearby && initialError && !initialError.hidden) initialRetry.focus({ preventScroll: true });
      }
      entering = false;
    }
  }
  root.addEventListener('click', event => {
    if (event.target.closest('[data-initial-retry]')) void enter(true);
  });
  const observer = new IntersectionObserver(entries => {
    nearby = entries.some(entry => entry.isIntersecting);
    if (nearby) void enter();
  }, { rootMargin:'300px' });
  observer.observe(root);
}
