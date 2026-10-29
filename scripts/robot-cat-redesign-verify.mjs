import {readFile,readdir,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {assertVisiblePLA} from './robot-cat-redesign-media.mjs';
import {readRedesignManifest} from '../src/scripts/robot-cat-redesign-state.ts';
const root=resolve(process.argv[2]??'dist');
const base=process.argv[3]??'/';
const manifest=readRedesignManifest(JSON.parse(await readFile(join(root,'media/robot-cat-story/v2/manifest.json'),'utf8')));
let total=0, minBrightPixels=Infinity;
for(const [i,path]of manifest.frames.entries()){
 const b=await readFile(join(root,'media/robot-cat-story/v2',path));
 assert.equal(b.length,manifest.bytes[i]);minBrightPixels=Math.min(minBrightPixels,await assertVisiblePLA(b,path));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
 assert.equal(b.toString('ascii',12,16),'VP8 ');assert.equal(b.readUInt16LE(26)&0x3fff,1600);assert.equal(b.readUInt16LE(28)&0x3fff,1000);total+=b.length;
}
assert.equal(total,manifest.totalBytes);
const files=[];
async function walk(dir){for(const file of await readdir(dir)){const path=join(dir,file);if((await stat(path)).isDirectory())await walk(path);else files.push(path)}}
await walk(root);
assert.equal(files.filter(p=>/\.(stl|3mf|glb|gltf|blend|py)$/i.test(p)).length,0,'No geometry or recipes in dist');
const html=await readFile(join(root,'models/robot-cat/index.html'),'utf8');
assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1);
assert.deepEqual([...html.matchAll(/<section\b[^>]*\bdata-story-key="([0-7])"/g)].map(m=>Number(m[1])),[0,1,2,3,4,5,6,7]);
assert(html.includes('К фото и характеристикам'));
assert(html.includes(`${base}media/robot-cat-story/v2/manifest.json`));
assert(!html.includes('data-sequence='));assert(!html.includes('story-comparison'));
assert(html.includes('robot-paint'));assert(html.includes('time-bar-short'));
assert(html.includes('model-cover'));assert(html.includes('data-model-title'));
for(const match of html.matchAll(/(?:src|href|srcset)="([^"#]+)"/g)){
 const path=match[1];if(path.startsWith('/')&&!path.startsWith('//'))assert(path.startsWith(base),`BASE prefix: ${path}`);
}
console.log(JSON.stringify({root,base,frames:manifest.frames.length,frameBytes:total,minBrightPixels,decodedCapacityBytes:10*1600*1000*4,forbiddenFiles:0,storyBeats:8},null,2));
