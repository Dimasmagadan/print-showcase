/** Static visual review boards; browser screenshots remain a separate check. */
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
const source = 'public/media/robot-cat-playground';
const output = 'docs/design/robot-cat-playground/review';
await mkdir(output, { recursive: true });
const heads = [['cat', 'Кот'], ['bunny', 'Заяц'], ['duck', 'Утка'], ['dog', 'Собака']];
const assemblies = [['robot-tail', 'Робот · с хвостом'], ['robot-plain', 'Робот · без хвоста'], ['cart-tail', 'Голова на тележке']];
const encode = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
async function board(name, tiles, columns) {
  const width = 320, height = 340, rows = Math.ceil(tiles.length / columns);
  const layers = [];
  for (const [index, tile] of tiles.entries()) {
    const x = index % columns * width, y = Math.floor(index / columns) * height;
    const image = await sharp(`${source}/${tile.file}.webp`).resize(width, width).png().toBuffer();
    const label = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x=".5" y=".5" width="319" height="339" fill="none" stroke="#6c5a50"/><text x="12" y="327" fill="#f2e7d8" font-family="sans-serif" font-size="14">${encode(tile.label)}</text></svg>`);
    layers.push({ input:image, left:x, top:y }, { input:label, left:x, top:y });
  }
  await sharp({ create: { width:width*columns, height:height*rows, channels:4, background:'#241b1a' } }).composite(layers).webp({ quality:88 }).toFile(`${output}/${name}.webp`);
}
for (const [name, suffix] of [['assemblies', ''], ['exploded', '-exploded']]) {
  const tiles = heads.flatMap(([head, label]) => assemblies.map(([assembly, title]) => ({ file:`${head}-${assembly}${suffix}`, label:`${label} · ${title}` })));
  await board(name, tiles, 3);
}
for (const [head] of heads) for (const body of ['tail','plain']) {
  const transition = [
    [`${head}-robot-${body}`, 'Робот'],
    ...[1,2,3].map(i => [`motion-${head}-robot-${body}-lift-${i}`, `Голова вверх ${i}`]),
    ...[1,2,3].map(i => [`support-${head}-${body}-robot-${i}`, `Робот уходит ${i}`]),
    [`support-${head}-head`, 'Только голова'],
    ...[3,2,1].map(i => [`support-${head}-${body}-cart-${i}`, `База входит ${4-i}`]),
    ...[3,2,1].map(i => [`motion-${head}-cart-tail-lift-${i}`, `Голова вниз ${4-i}`]),
    [`${head}-cart-tail`, 'Тележка'],
  ].map(([file,label]) => ({ file, label }));
  await board(`robot-to-cart-${head}-${body}`, transition, 3);
  if (head === 'cat' && body === 'tail') await board('robot-to-cart', transition, 3);
}
for (const mode of ['robot','cart']) {
  const body = 'tail';
  const swap = [
    [`cat-${mode}-${body}`, 'Кот'],
    ...[1,2,3].map(i => [`motion-cat-${mode}-${body}-lift-${i}`, `Кот вверх ${i}`]),
    ...[3,2,1].map(i => [`motion-duck-${mode}-${body}-lift-${i}`, `Утка вниз ${4-i}`]),
    [`duck-${mode}-${body}`, 'Утка'],
  ].map(([file,label]) => ({ file, label }));
  await board(`head-swap-${mode}`, swap, 4);
}
// Enlarged wheel faces make the rotation marker visible at review scale.
{
  const files=['cat-cart-tail','motion-cat-cart-wheel-1','motion-cat-cart-wheel-2','motion-cat-cart-wheel-3'];
  const layers=[];
  for (const [i,file] of files.entries()) {
    const image=await sharp(`${source}/${file}.webp`).extract({left:300,top:355,width:180,height:180}).resize(320,320).png().toBuffer();
    const label=Buffer.from(`<svg width="320" height="340" xmlns="http://www.w3.org/2000/svg"><rect x=".5" y=".5" width="319" height="339" fill="none" stroke="#6c5a50"/><text x="12" y="327" fill="#f2e7d8" font-family="sans-serif" font-size="14">Фаза ${i} · поворот ${i*90}°</text></svg>`);
    layers.push({input:image,left:i*320,top:0},{input:label,left:i*320,top:0});
  }
  await sharp({create:{width:1280,height:340,channels:4,background:'#241b1a'}}).composite(layers).webp({quality:88}).toFile(`${output}/wheel-phases.webp`);
}
console.log(`Visual review boards written to ${output}`);
