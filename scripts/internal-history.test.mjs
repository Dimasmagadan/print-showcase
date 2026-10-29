import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readHomeReturn } from '../src/scripts/internal-history.ts';

const entry = { version: 1, model: 'robot-cat', source: 'hero', motion: true,
  offset: 128, progress: .9, keyboard: true };
test('history metadata preserves each independent source entry', () => {
  const first = structuredClone(entry);
  const second = { ...entry, model: 'animal-puzzle', source: 'catalog', offset: -24 };
  assert.deepEqual(readHomeReturn(first), entry);
  assert.deepEqual(readHomeReturn(second), second);
  assert.equal(readHomeReturn(first).model, 'robot-cat');
});
test('malformed and incompatible history metadata uses ordinary restoration', () => {
  for (const invalid of [null, {}, { ...entry, version: 2 }, { ...entry, model: '../cat' },
    { ...entry, source: 'unknown' }, { ...entry, motion: 1 }, { ...entry, progress: NaN },
    { ...entry, progress: 2 }, { ...entry, offset: Infinity }, { ...entry, keyboard: null }]) {
    assert.equal(readHomeReturn(invalid), null);
  }
});
