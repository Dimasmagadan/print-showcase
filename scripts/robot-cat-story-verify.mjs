/** Audit built HTML/media and compare unaffected pages against stage A. */
import assert from 'node:assert/strict';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { readSequence } from '../src/scripts/robot-cat-story-state.ts';

const dist = resolve('dist');
const baseline = '/tmp/print-showcase-robot-story/baseline/dist';
const base = (process.env.BASE ?? '/').replace(/\/?$/, '/');
const text = path => readFile(path, 'utf8');
async function files(dir) {
  return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]))).flat();
}
const all = await files(dist);
const html = all.filter(path => path.endsWith('.html'));
async function fingerprints(root) {
  const assets = (await files(join(root, '_astro'))).filter(path => path.endsWith('.webp'));
  return new Map(await Promise.all(assets.map(async path => ['/_astro/' + relative(join(root, '_astro'), path), createHash('sha256').update(await readFile(path)).digest('hex')])));
}
const oldAssets = await fingerprints(baseline), newAssets = await fingerprints(dist);
// Astro's optimized image names also depend on BASE. Compare their actual bytes,
// retaining all image attributes, dimensions, source identities and CSS.
const normalized = (source, assets = newAssets) => source.replaceAll(base, '/').replace(/<script\b[^>]*src="[^"]+"[^>]*>\s*<\/script>/g, '')
  .replace(/\/_astro\/[^"\s<>]+\.webp/g, path => assets.has(path) ? `/_astro/${assets.get(path)}.webp` : path);
const comparison = [];
let links = 0;
for (const path of html) {
  const source = await text(path);
  const rel = relative(dist, path);
  for (const [, , value] of source.matchAll(/\b(src|href)="([^"]+)"/g)) {
    if (/^(?:https?:|data:|mailto:|tel:|#)/.test(value)) continue;
    const url = new URL(value, `http://local${base}${rel}`);
    assert(url.pathname.startsWith(base), `${rel}: URL outside BASE: ${value}`);
    let target = join(dist, decodeURIComponent(url.pathname.slice(base.length)));
    if (url.pathname.endsWith('/')) target = join(target, 'index.html');
    assert((await stat(target)).isFile(), `${rel}: missing ${value}`);
    links++;
  }
  if (rel !== 'models/robot-cat/index.html') {
    assert.equal(normalized(source), normalized(await text(join(baseline, rel)), oldAssets), `Baseline regression: ${rel}`);
    assert(!source.includes('robot-cat-story'), `Story markup/styles leaked: ${rel}`);
    comparison.push(rel);
  }
}
const robot = await text(join(dist, 'models/robot-cat/index.html'));
const original = await text(join(baseline, 'models/robot-cat/index.html'));
for (const pattern of [/<header class="model-head">[\s\S]*?<\/header>/, /<div class="cover"[^>]*>[\s\S]*?<\/div>/, /<div class="gallery">[\s\S]*?<\/div>/, /<dialog[\s\S]*?<\/dialog>/]) {
  assert.equal(normalized(robot.match(pattern)?.[0] ?? ''), normalized(original.match(pattern)?.[0] ?? '', oldAssets), `Shared model structure changed: ${pattern}`);
}
assert.equal((robot.match(/<h1\b/g) ?? []).length, 1);
assert.equal((robot.match(/class="cover"/g) ?? []).length, 1);
assert(!robot.includes('Печать шла около 14') && !robot.includes('class="model-layout"'));
assert(robot.includes('с кошачьей головой'));
assert(robot.includes('плюс сменная голова зайца'));
assert(robot.includes(`${base}media/robot-cat-story/v1/manifest.json`));
const manifestDir = join(dist, 'media/robot-cat-story/v1');
const manifest = JSON.parse(await text(join(manifestDir, 'manifest.json')));
let count = 0, bytes = 0;
for (const sequence of ['split', 'swap']) {
  const frames = readSequence(manifest, sequence);
  for (const [i, path] of frames.entries()) {
    const file = join(manifestDir, path);
    assert(file.startsWith(manifestDir + '/'));
    assert.equal((await stat(file)).size, manifest.sequences[sequence].bytes[i]);
    bytes += (await stat(file)).size; count++;
  }
}
assert.equal(count, 80); assert.equal(bytes, manifest.totalBytes); assert(bytes <= 6_000_000);
assert.deepEqual(await readFile(join(manifestDir, 'split/000.webp')), await readFile(join(manifestDir, 'swap/000.webp')));
const forbidden = all.filter(path => /\.(stl|3mf|glb|gltf|blend|py)$/i.test(path));
assert.deepEqual(forbidden, []);
const scripts = all.filter(path => /\/robot-cat-story\.[^/]+\.js$/.test(path));
assert.equal(scripts.length, 1);
const jsBytes = (await stat(scripts[0])).size;
const report = { base, pages: html.length, unchangedPages: comparison, preserved: ['robot header', 'original cover', 'gallery', 'lightbox'], localReferences: links, frameCount: count, frameBytes: bytes, storyJSBytes: jsBytes, forbiddenFiles: forbidden };
await writeFile(`/tmp/print-showcase-robot-story/audit-${base === '/' ? 'root' : 'prefixed'}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
