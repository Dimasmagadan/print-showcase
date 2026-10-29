/** History metadata belongs to an entry, never to a global "last model". */
export interface HomeReturn {
  version: 1;
  model: string;
  source: 'catalog' | 'hero';
  motion: boolean;
  offset: number;
  progress: number;
  keyboard: boolean;
}

export function readHomeReturn(value: unknown): HomeReturn | null {
  const state = value as Partial<HomeReturn> | null;
  if (!state || state.version !== 1 || typeof state.model !== 'string' ||
      !/^[a-z0-9-]+$/.test(state.model) ||
      !['catalog', 'hero'].includes(state.source as string) ||
      typeof state.motion !== 'boolean' || typeof state.keyboard !== 'boolean' ||
      !Number.isFinite(state.offset) || !Number.isFinite(state.progress) ||
      state.progress! < 0 || state.progress! > 1) return null;
  return state as HomeReturn;
}
