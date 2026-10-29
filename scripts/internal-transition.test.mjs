import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageGeometry, validTransition } from '../src/scripts/internal-transition-geometry.js';

const box = { left: 100, top: 200, width: 320, height: 240 };
test('portrait photo expands without stretching while revealing its crop', () => {
  const source = imageGeometry(box, box, 1200, 1600, 'cover');
  assert.equal(source.width, 320);
  assert.equal(source.height, 320 * 4 / 3);
  assert.equal(source.inset[1], 0);
  assert.ok(Math.abs(source.inset[0] - 21.875) < .0001);
  const target = imageGeometry({ ...box, width: 1088, height: 648 },
    { ...box, width: 1088, height: 648 }, 1200, 1600, 'contain');
  assert.ok(Math.abs(target.width / target.height - source.width / source.height) < 1e-12);
  assert.deepEqual(target.inset, [0, 0, 0, 0]);
});
test('contain render keeps its aspect and white margins outside the shared image', () => {
  const result = imageGeometry(box, box, 1600, 900, 'contain');
  assert.equal(result.width, 320);
  assert.equal(result.height, 180);
  assert.equal(result.top, 230);
  assert.deepEqual(result.inset, [0, 0, 0, 0]);
});
test('actual hover scale participates in geometry and clipping', () => {
  const result = imageGeometry({ left: 96, top: 197, width: 328, height: 246 }, box, 1600, 900, 'cover');
  assert.equal(result.width, 246 * 16 / 9);
  assert.ok(result.inset.every(n => n > 0));
});
test('invalid dimensions and invisible subjects use fallback', () => {
  assert.equal(imageGeometry(box, box, 0, 100, 'cover'), null);
  assert.equal(imageGeometry(box, box, 100, 100, 'fill'), null);
  assert.equal(imageGeometry(box, { ...box, left: 1000 }, 100, 100, 'contain'), null);
});
test('one-use handoff rejects wrong entry, destination, expiry and malformed clipping', () => {
  const state = { version: 1, from: '/home', to: '/model', key: 'entry-A', time: 100,
    model: 'robot-cat', source: 'hero', asset: '', geometry: null };
  const valid = value => validTransition(value, '/home', '/model', 'entry-A', 200);
  assert.equal(valid(state), true);
  for (const value of [{ ...state, key: 'entry-B' }, { ...state, to: '/other' },
    { ...state, time: -20000 }, { ...state, model: 'bad;css' },
    { ...state, geometry: {} }, { ...state, geometry: { left: 0, top: 0, width: 2, height: 3, inset: ['bad', 0, 0, 0] } }]) {
    assert.equal(Boolean(valid(value)), false);
  }
});
