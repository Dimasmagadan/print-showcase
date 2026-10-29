import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { Script } from 'node:vm';
import { gzipSync } from 'node:zlib';

const html = await readFile('dist/models/robot-cat/index.html', 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const runtime = scripts.find(([, , code]) => code.includes('internal-transition:v1'))[2];
new Script(runtime); // Verify actual emitted classic JS, including raw imports.
const measure = code => ({ bytes: Buffer.byteLength(code), gzipBytes: gzipSync(code).length });
const cssDiff = execFileSync('git', ['diff', '--no-ext-diff', '--unified=0', 'HEAD', '--', 'src/styles/global.css'], { encoding: 'utf8' });
const addedCSS = cssDiff.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'))
  .map(line => line.slice(1)).join('\n') + '\n';
const modelModules = [];
for (const [, attrs, inline] of scripts.filter(([, attrs]) => attrs.includes('type="module"'))) {
  const src = attrs.match(/src="([^"]+)"/)?.[1];
  const code = src ? await readFile(`dist/_astro/${src.split('/').at(-1)}`, 'utf8') : inline;
  modelModules.push({ ...measure(code), ...(src ? { src } : {}), includesHistory: code.includes('homeReturn') });
}
const report = {
  inlineTransitionJS: measure(runtime), addedCSS: measure(addedCSS),
  note: 'Standalone gzip measurements, not incremental response compression. Direct model modules include existing gallery and new history code; shared imports are not counted here.',
  modelModules,
};
await writeFile('docs/design/internal-motion/code-size.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
