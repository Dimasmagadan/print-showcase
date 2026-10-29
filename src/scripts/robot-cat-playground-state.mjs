/** Pure state transitions for the playground. Media is committed only after decoding. */
export const HEADS = ['cat', 'bunny', 'duck', 'dog'];
export const BODIES = ['tail', 'plain'];
export const MODES = ['robot', 'cart'];
export const ROBOT_SCALE = 1.15, CART_SCALE = 1.5, CART_TRAVEL_FRACTION = .18;
export const initialState = () => ({ head: 'cat', mode: 'robot', body: 'tail', exploded: false, position: 0, velocity: 0, editor: false, drawing: [], undo: [] });

const stop = state => ({ ...state, position: 0, velocity: 0 });
const remember = (state, drawing) => ({ ...state, drawing, undo: [...state.undo, state.drawing].slice(-20) });

/** Apply only a fully loaded selection; invalid values leave the scene untouched. */
export function transition(state, action) {
  switch (action.type) {
    case 'head':
      return HEADS.includes(action.value) && action.value !== state.head ? { ...stop(state), head: action.value } : state;
    case 'mode':
      return MODES.includes(action.value) && action.value !== state.mode ? { ...stop(state), mode: action.value, exploded: false, editor: false } : state;
    case 'body':
      return (state.mode === 'robot' || action.allowDuringTransition) && BODIES.includes(action.value) ? { ...state, body: action.value } : state;
    case 'explode':
      return { ...stop(state), exploded: !state.exploded, editor: false };
    case 'editor':
      return state.mode === 'robot' ? { ...state, exploded: false, editor: !!action.open } : state;
    case 'move':
      return state.mode === 'cart' && !state.exploded && Number.isFinite(action.position) ? { ...state, position: Math.max(-1, Math.min(1, action.position)), velocity: Number.isFinite(action.velocity) ? action.velocity : 0 } : state;
    case 'stop':
      return { ...state, velocity: 0 };
    case 'draw':
      return state.mode === 'robot' && state.editor ? remember(state, [...state.drawing, action.stroke]) : state;
    case 'clear':
      return state.mode === 'robot' && state.editor && state.drawing.length ? remember(state, []) : state;
    case 'undo':
      return state.mode === 'robot' && state.editor && state.undo.length ? { ...state, drawing: state.undo[state.undo.length - 1], undo: state.undo.slice(0, -1) } : state;
    default:
      return state;
  }
}

/** Latest request wins, including when an earlier load resolves or rejects later. */
export function createSelectionLoader(load, commit, fail) {
  let revision = 0;
  return {
    async select(action) {
      const current = ++revision;
      try {
        await load(action);
        if (current === revision) commit(action);
      } catch (error) {
        if (current === revision) fail(action, error);
      }
    },
    cancel() { revision++; },
  };
}

/** Decide gesture direction once enough movement is available; vertical remains scrollable. */
export function gestureDirection(dx, dy, threshold = 8) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return 'pending';
  return Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
}

/** Serialize media work and replace any waiting request with the newest one. */
export function createLatestQueue(load) {
  let active = false, waiting = null, idle = [], controller = null;
  async function pump() {
    if (active || !waiting) return;
    active = true;
    const item = waiting; waiting = null; controller = new AbortController();
    try { item.resolve(await load(item.value, controller.signal)); }
    catch (error) { item.reject(error); }
    finally { active = false; controller = null; pump(); if (!active && !waiting) idle.splice(0).forEach(resolve => resolve()); }
  }
  const request = value => new Promise((resolve, reject) => {
    if (waiting) waiting.resolve(null);
    controller?.abort();
    waiting = { value, resolve, reject };
    pump();
  });
  request.busy = () => active || !!waiting;
  request.drain = () => {
    controller?.abort();
    if (waiting) { waiting.resolve(null); waiting = null; }
    return active ? new Promise(resolve => idle.push(resolve)) : Promise.resolve();
  };
  return request;
}

/** Frame names for depth-correct poses; mode changes never mix robot and cart parts. */
export function motionFrames(previous, next, action, reduced = false) {
  if (reduced) return [];
  if (action.type === 'body' && previous.mode === 'robot' && next.mode === 'robot' && previous.head === next.head && previous.body !== next.body && !previous.exploded && !next.exploded) {
    return [1, 2, 3].map(i => `body-${previous.head}-${previous.body}-${i}.webp`).concat([3, 2, 1].map(i => `body-${next.head}-${next.body}-${i}.webp`));
  }
  if (previous.body !== next.body) return [];
  const file = (s, kind, frame) => `motion-${s.head}-${s.mode}-${s.mode === 'cart' ? 'tail' : s.body}-${kind}-${frame}.webp`;
  if (action.type === 'mode' && previous.mode !== next.mode && !previous.exploded) {
    const body = previous.body;
    const exit = [1, 2, 3].map(i => `support-${previous.head}-${body}-robot-${i}.webp`);
    const enter = [3, 2, 1].map(i => `support-${previous.head}-${body}-cart-${i}.webp`);
    const middle = [...exit, `support-${previous.head}-head.webp`, ...enter];
    const poses = previous.mode === 'robot' ? middle : middle.reverse();
    return [1, 2, 3].map(i => file(previous, 'lift', i)).concat(poses, [3, 2, 1].map(i => file(next, 'lift', i)));
  }
  if (previous.mode !== next.mode) return [];
  if (action.type === 'explode' && previous.head === next.head) {
    const frames = [1, 2, 3].map(i => file(previous, 'explode', i));
    return previous.exploded ? frames.reverse() : frames;
  }
  if (action.type === 'head' && !previous.exploded && !next.exploded && previous.head !== next.head) {
    return [1, 2, 3].map(i => file(previous, 'lift', i)).concat([3, 2, 1].map(i => file(next, 'lift', i)));
  }
  return [];
}
export function wheelPhase(position) {
  // Orthographic field is 320 mm; the physical wheel radius is 20 mm.
  const angle = -position * CART_TRAVEL_FRACTION / (CART_SCALE * 20 / 320);
  return ((Math.round(angle / (Math.PI / 2)) % 4) + 4) % 4;
}

/** A held pointer must not retain a stale fling velocity. */
export function releaseVelocity(velocity, ageMs) {
  if (!Number.isFinite(velocity) || !Number.isFinite(ageMs)) return 0;
  return Math.max(-2, Math.min(2, velocity)) * Math.exp(-Math.max(0, ageMs) / 80);
}
