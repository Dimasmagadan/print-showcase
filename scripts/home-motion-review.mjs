/** Freeze build markup at named scroll positions. These are design layouts,
 * not screenshots or evidence that a browser acceptance check has passed.
 * Run after npm run build: node scripts/home-motion-review.mjs
 */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { homeMotionState, HOME_MOTION } from '../src/scripts/home-motion-state.ts';

const output = resolve('docs/design/home-motion/review');
await mkdir(`${output}/assets`, { recursive: true });
const built = await readFile('dist/index.html', 'utf8');
const noScripts = built.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
const assetPaths = [...new Set(noScripts.match(/(?:\/[\w-]+)*\/_astro\/[\w.-]+/g))];
let source = noScripts;
for (const url of assetPaths) {
  const name = basename(url);
  await copyFile(`dist/_astro/${name}`, `${output}/assets/${name}`);
  source = source.replaceAll(url, `assets/${name}`);
}
// No live external font dependency in the frozen layouts. A local Inter
// installation is used when available; otherwise the site's system fallback.
source = source.replace(/<link[^>]+(?:fonts\.googleapis|fonts\.gstatic)[^>]*>/g, '');
const head = source.match(/<head>([\s\S]*?)<\/head>/)[1];
const header = source.match(/<header\b[\s\S]*?<\/header>/)[0];
const hero = source.match(/<section class="home-story"[\s\S]*?<\/section>/)[0];
const body = source.match(/<body>([\s\S]*)<\/body>/)[1];
const properties = {
  catHeight: ['--cat-height', '%'], catX: ['--cat-x', '%'], catBottom: ['--cat-bottom', '%'],
  printerScale: ['--printer-scale', ''], doorDetail: ['--door-detail', ''],
  printerOpacity: ['--printer-opacity', ''], workshopOpacity: ['--workshop-opacity', ''],
  warmth: ['--warmth', ''], reflection: ['--reflection', ''],
  introOpacity: ['--intro-opacity', ''], captionOpacity: ['--caption-opacity', ''],
};
const frames = [
  ['H01', 0], ['H02', .40], ['H03', .58], ['H04', .90],
  ['join-H02-H03-before', .445], ['join-H02-H03-after', .455],
  ['join-H03-H04-before', .695], ['join-H03-H04-after', .705],
];
const manifest = { kind: 'frozen HTML design layouts; browser acceptance pending', settings: HOME_MOTION, frames: [] };
for (const [width, height] of [[1440, 900], [1920, 1080]]) {
  for (const [name, progress] of frames) {
    const state = homeMotionState(progress);
    const style = Object.entries(properties).map(([key, [property, unit]]) => `${property}:${state[key]}${unit}`).join(';');
    let scene = hero.replace(/data-stage\b/, `data-stage style="${style}"`)
      .replace(/data-home-motion\b/, 'data-home-motion data-ready')
      .replace(/data-src="([^"]+)"/g, 'src="$1"');
    if (state.captionOpacity === 1) scene = scene.replace(/data-caption inert/, 'data-caption');
    if (state.introOpacity < .05) scene = scene.replace(/data-actions\b/, 'data-actions inert');
    const file = `${name}-${width}x${height}.html`;
    const stageRules = `.home-story,.home-hero{height:${height}px!important;min-height:0!important}.home-hero{position:relative!important}.scene-world{width:min(100%,${height * 16 / 9}px)!important}`;
    await writeFile(`${output}/${file}`, `<!doctype html><html lang="ru" class="home-motion"><head>${head}<style>html,body{width:${width}px;height:${height}px;overflow:hidden;margin:0}${stageRules}</style></head><body>${progress === 0 ? header : ''}<main>${scene}</main></body></html>`);
    manifest.frames.push({ name, width, height, progress, state, file });
  }
}
for (const [width, height] of [[1440, 900], [390, 844], [360, 800]]) {
  await writeFile(`${output}/static-${width}x${height}.html`, `<!doctype html><html lang="ru"><head>${head}<style>html,body{width:${width}px;min-height:${height}px;margin:0}</style></head><body>${body}</body></html>`);
}
const tiles = manifest.frames.filter(f => f.width === 1440).map(f => `<article><h2>${f.name} · ${Math.round(f.progress * 1000) / 10}%</h2><div class="frame"><iframe title="${f.name}" src="${f.file}" width="1440" height="900" loading="lazy"></iframe></div><a href="${f.file}">Открыть 1440×900</a> · <a href="${f.name}-1920x1080.html">1920×1080</a></article>`).join('');
await writeFile(`${output}/index.html`, `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Home motion — опорные макеты</title><style>body{font:16px/1.5 system-ui;background:#0d0d12;color:#f5f5f7;margin:32px}a{color:#ffbc36}main{display:grid;grid-template-columns:repeat(auto-fit,576px);gap:32px}h2{font-size:16px}.frame{width:576px;height:360px;overflow:hidden;border:1px solid #30313a}iframe{border:0;transform:scale(.4);transform-origin:0 0}</style><h1>Из принтера — в реальный мир</h1><p>Опорные HTML-макеты из сборки, без выполнения скриптов. Это не браузерные скриншоты и не подтверждение приёмки. Точный Inter зависит от локальной установки шрифта.</p><p>Статика: <a href="static-1440x900.html">1440×900</a> · <a href="static-390x844.html">390×844</a> · <a href="static-360x800.html">360×800</a></p><main>${tiles}</main></html>`);
await writeFile(`${output}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${manifest.frames.length} scene layouts, 3 static layouts and contact sheet: ${output}/index.html`);
