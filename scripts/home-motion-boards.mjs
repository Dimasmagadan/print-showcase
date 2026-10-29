/** Raster design studies from the production geometry/mask, not browser captures.
 * Run after npm run build && node scripts/home-motion-review.mjs.
 * The HTML layouts remain authoritative for wrapping and browser typography.
 */
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { HOME_CAT_MASK, HOME_CAT_CONTACTS } from '../src/scripts/home-cat-mask.ts';

const directory = 'docs/design/home-motion/review';
const manifest = JSON.parse(await readFile(`${directory}/manifest.json`, 'utf8'));
const built = await readFile('dist/index.html', 'utf8');
const photoURL = built.match(/<image href="([^"]+)"/)[1];
// librsvg's embedded-image decoder requires PNG/JPEG, unlike web browsers.
const photo = await sharp(await readFile(`dist/_astro/${photoURL.split('/').pop()}`)).png().toBuffer();
const printer = await sharp('src/assets/hero/robot-cat/printer-empty-v1.png').png().toBuffer();
const workshop = await sharp('src/assets/hero/robot-cat/workshop-empty-v1.png').png().toBuffer();
const door = await readFile('src/assets/hero/robot-cat/door-frame-detail.svg');
const data = (bytes, mime = 'image/png') => `data:${mime};base64,${bytes.toString('base64')}`;
const text = (x, y, size, lines, fill = '#f5f5f7', weight = 400, leading = 1.2) => `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" font-family="Inter, Arial, sans-serif">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? size * leading : 0}">${line}</tspan>`).join('')}</text>`;

for (const frame of manifest.frames) {
  const { width: w, height: h, state: s } = frame;
  const ww = Math.min(w, h * 16 / 9), wh = ww * 9 / 16;
  const wx = (w - ww) / 2, wy = h - wh + (s.progress === 0 ? 72 : 0);
  const ch = wh * s.catHeight / 100, cw = ch * 730 / 1490;
  const cx = ww * s.catX / 100 - cw / 2, cy = wh * (1 - s.catBottom / 100) - ch;
  const px = ww * .715, py = wh * .59;
  const copyX = Math.max(48, (w - 1440) / 2 + 48);
  const captionSize = Math.min(38, w * .024);
  const captionX = copyX, captionY = h * .44;
  const bodyY = (h - 308) / 2 + (s.progress === 0 ? 72 : 0);
  const shadow = `<g fill="none" stroke="#090706" stroke-width="16" stroke-linecap="round" opacity=".75" filter="url(#shadow)">${HOME_CAT_CONTACTS.map(path => `<path d="${path}"/>`).join('')}</g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <clipPath id="cat"><path clip-rule="evenodd" d="${HOME_CAT_MASK}"/></clipPath>
      <filter id="shadow" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="7"/></filter>
      <filter id="warm"><feColorMatrix type="saturate" values="${1 - s.warmth * .08}"/><feComponentTransfer><feFuncR type="linear" slope="${1 - s.warmth * .1}"/><feFuncG type="linear" slope="${1 - s.warmth * .12}"/><feFuncB type="linear" slope="${1 - s.warmth * .16}"/></feComponentTransfer></filter>
      <linearGradient id="shade"><stop stop-color="#0d0d12" stop-opacity=".85"/><stop offset=".35" stop-color="#0d0d12" stop-opacity=".4"/><stop offset=".6" stop-color="#0d0d12" stop-opacity="0"/></linearGradient>
      <linearGradient id="glass"><stop stop-color="#d5d9df" stop-opacity="0"/><stop offset=".48" stop-color="#d5d9df" stop-opacity=".53"/><stop offset="1" stop-color="#d5d9df" stop-opacity="0"/></linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="#0d0d12"/>
    <g transform="translate(${wx} ${wy})">
      <g opacity="${s.printerOpacity}" transform="translate(${px} ${py}) scale(${s.printerScale}) translate(${-px} ${-py})">
        <image href="${data(printer)}" width="${ww}" height="${wh}"/>
        <image href="${data(door, 'image/svg+xml')}" width="${ww}" height="${wh}" opacity="${s.doorDetail}"/>
      </g>
      <image href="${data(workshop)}" width="${ww}" height="${wh}" opacity="${s.workshopOpacity}"/>
      <svg x="${cx}" y="${cy}" width="${cw}" height="${ch}" viewBox="220 210 730 1490" overflow="visible">
        ${shadow}<image href="${data(photo)}" width="1152" height="2048" clip-path="url(#cat)" filter="url(#warm)"/>
      </svg>
      <rect x="${ww * .52}" y="${wh * .26}" width="${ww * .35}" height="${wh * .65}" fill="url(#glass)" opacity="${s.reflection}"/>
    </g>
    <rect width="${w}" height="${h}" fill="url(#shade)"/>
    ${s.progress === 0 ? `${text(copyX, 45, 20, ['Print Showcase'], '#ffbc36', 800)}${text(w - copyX - 164, 43, 14, ['Модели　Telegram'], '#b0b1bb')}` : ''}
    <g opacity="${s.introOpacity}">
      ${text(copyX, bodyY, 11, ['АВТОРСКАЯ 3D-ПЕЧАТЬ'], '#ffbc36', 700)}
      ${text(copyX, bodyY + 66, 48, ['Придумываю и', 'печатаю вещи'], '#f5f5f7', 800, 1.1)}
      ${text(copyX, bodyY + 171, 16, ['Модели, которые я придумал, смоделировал и напечатал', 'на 3D-принтере. Здесь — как появилась каждая:', 'идея, моделирование, печать и что пошло не так.'], '#b0b1bb', 400, 1.55)}
      <rect x="${copyX}" y="${bodyY + 256}" width="185" height="50" rx="6" fill="#ffbc36"/>
      <rect x="${copyX + 197}" y="${bodyY + 256}" width="187" height="50" rx="6" fill="#272830"/>
      ${text(copyX + 20, bodyY + 287, 16, ['Смотреть модели'], '#17130a', 600)}
      ${text(copyX + 217, bodyY + 287, 16, ['Telegram-канал'], '#f5f5f7', 600)}
    </g>
    <g opacity="${s.captionOpacity}">
      ${text(captionX, captionY + 12, 11, ['ИЗ ПРИНТЕРА — В РЕАЛЬНЫЙ МИР'], '#ffbc36', 700)}
      ${text(captionX, captionY + 64, captionSize, ['Робот-кот из', '«Трёх котов»'], '#f5f5f7', 700)}
      ${text(captionX, captionY + 64 + captionSize * 1.2 + 51, 16, ['История модели →'], '#ffbc36', 600)}
    </g>
  </svg>`;
  const png = frame.file.replace('.html', '.png');
  await sharp(Buffer.from(svg)).png().toFile(`${directory}/${png}`);
  frame.rasterStudy = png;
}
const tiles = await Promise.all(manifest.frames.filter(f => f.width === 1440).map(async (f, index) => {
  const thumb = await sharp(`${directory}/${f.rasterStudy}`).resize(720, 450).png().toBuffer();
  const label = Buffer.from(`<svg width="720" height="40"><rect width="720" height="40" fill="#18191f"/>${text(16, 27, 16, [f.name], '#ffbc36', 600)}</svg>`);
  return [{ input: thumb, left: index % 2 * 720, top: Math.floor(index / 2) * 490 + 40 }, { input: label, left: index % 2 * 720, top: Math.floor(index / 2) * 490 }];
}));
await sharp({ create: { width: 1440, height: 1960, channels: 3, background: '#0d0d12' } }).composite(tiles.flat()).png().toFile(`${directory}/contact-sheet.png`);
manifest.rasterNote = 'PNG files are code-rendered composition studies with approximate typography/reflection, not browser screenshots. Use frozen HTML layouts for production CSS and text wrapping.';
await writeFile(`${directory}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('Wrote 16 full-size PNG composition studies and contact-sheet.png (not browser captures).');
