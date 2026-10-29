/** Structural build audit only. No claim about browser rendering or history. */
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';

const base = `/${(process.env.BASE ?? '').replace(/^\/+|\/+$/g, '')}`.replace(/\/?$/, '/');
const home = await readFile('dist/index.html', 'utf8');
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(([tag]) => attributes(tag));
const cards = tags(home, 'a').filter(a => a.class === 'model-card');
const pages = (await readdir('dist/models', { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
assert.deepEqual(cards.map(card => card['data-model-id']).sort(), pages);
const results = [];
for (const id of pages) {
  const html = await readFile(`dist/models/${id}/index.html`, 'utf8');
  const article = tags(html, 'article').find(a => a['data-model-page']);
  const card = cards.find(card => card['data-model-id'] === id);
  assert.equal(article['data-model-page'], id);
  assert.equal(article['data-cover-key'], card['data-cover-key'], `${id}: same source asset`);
  const cardMarkup = home.match(new RegExp(`<a class="model-card"[^>]*data-model-id="${id}"[^>]*>([\\s\\S]*?)<\\/a>`))?.[1];
  const cardTitle = cardMarkup?.match(/<h3[^>]*>\s*<span data-model-title[^>]*>([\s\S]*?)<\/span>\s*<\/h3>/)?.[1];
  const pageTitle = html.match(/<h1[^>]*>\s*<span data-model-title[^>]*>([\s\S]*?)<\/span>\s*<\/h1>/)?.[1];
  assert.ok(cardTitle, `${id}: shared card title`);
  assert.equal(pageTitle, cardTitle, `${id}: same title in H3 and H1`);
  assert.equal(card.href, `${base}models/${id}/`);
  assert.equal(tags(html, 'a').find(a => a.class === 'back').href, `${base}#models`);
  assert.equal(tags(html, 'a').find(a => a.class === 'logo').href, base);
  assert.equal(tags(html, 'a').find(a => a.class === 'skip-link').href, '#main');
  assert.equal(tags(html, 'h1').length, 1);
  assert.equal(tags(html, 'main').length, 1);
  assert.equal(tags(html, 'main')[0].id, 'main');
  assert.ok(!tags(html, 'html')[0].class, 'base HTML has no hidden motion state');
  const cover = html.match(/<div class="cover"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  assert.ok(cover, `${id}: cover exists`);
  const image = tags(cover, 'img')[0];
  assert.ok(Number(image.width) > 0 && Number(image.height) > 0, `${id}: reserved media dimensions`);
  assert.ok(image.alt, `${id}: meaningful cover alternative`);
  assert.equal(image.loading, 'eager');
  assert.ok(!html.includes('ClientRouter'));
  const discussionWidgets = tags(html, 'script').filter(script => script.src?.startsWith('https://telegram.org/'));
  assert.ok(discussionWidgets.length <= 1);
  assert.ok(!/<video\b[^>]*\bautoplay\b/.test(html));
  results.push({ id, asset: article['data-cover-key'], width: Number(image.width), height: Number(image.height), discussionWidgets: discussionWidgets.length });
}
const result = { kind: 'structural build audit; not browser evidence', base, pages: results };
await writeFile('docs/design/internal-motion/build-audit.json', JSON.stringify(result, null, 2) + '\n');
console.log(`Structural build audit passed: ${pages.length} published models, BASE=${base}`);
