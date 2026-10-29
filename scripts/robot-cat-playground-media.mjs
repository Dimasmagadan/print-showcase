/** Compress private Blender renders into the local playground raster set. */
import { readdir, mkdir, stat } from 'node:fs/promises';
import sharp from 'sharp';
import { resolve } from 'node:path';
const source = '/tmp/robot-cat-playground/full';
const target = resolve('public/media/robot-cat-playground');
await mkdir(target, { recursive: true });
let total = 0;
for (const file of (await readdir(source)).filter(name => name.endsWith('.png'))) {
  const name = file.replace(/\.png$/, '.webp');
  await sharp(`${source}/${file}`).resize(640, 640).webp({ quality: 82, alphaQuality: 90 }).toFile(`${target}/${name}`);
  total += (await stat(`${target}/${name}`)).size;
}
console.log(`Playground raster set: ${(total / 1048576).toFixed(2)} MiB`);
// A single compact thumbnail sheet avoids four independent image requests.
const thumbnails = [];
for (const [index, head] of ['cat', 'bunny', 'duck', 'dog'].entries()) {
  const input = await sharp(`${source}/${head}-robot-plain.png`)
    .extract({ left: 275, top: 80, width: 250, height: 340 })
    .resize(125, 170).png().toBuffer();
  thumbnails.push({ input, left: index * 125, top: 0 });
}
await sharp({ create: { width: 500, height: 170, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(thumbnails).webp({ quality: 80 }).toFile(`${target}/heads.webp`);
