import assert from 'node:assert/strict';
import { test } from 'node:test';
import { orderHomeModels } from '../src/home-featured.ts';

const model = (id, year, draft = false) => ({ id, data: { date: new Date(`${year}-01-01`), draft } });

test('a newer publication does not replace the home subject; other models retain date order', () => {
  const input = [model('old', 2024), model('new', 2028), model('robot-cat', 2026)];
  const { models, featured } = orderHomeModels(input);
  assert.deepEqual(models.map(({ id }) => id), ['robot-cat', 'new', 'old']);
  assert.equal(featured, input[2]);
  assert.deepEqual(input.map(({ id }) => id), ['old', 'new', 'robot-cat']);
});

test('missing and draft subjects produce an ordinary published catalog', () => {
  for (const subject of [[], [model('robot-cat', 2029, true)]]) {
    const { models, featured } = orderHomeModels([model('old', 2024), ...subject, model('new', 2028)]);
    assert.equal(featured, undefined);
    assert.deepEqual(models.map(({ id }) => id), ['new', 'old']);
  }
});
