/** Frozen layout studies, not browser screenshots or acceptance evidence. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homeMotionState } from '../src/scripts/home-motion-state.ts';
const geometryCode = (await readFile('src/scripts/internal-transition-geometry.js', 'utf8')).replace(/^export /gm, '');

const output = 'docs/design/internal-motion/layouts';
await mkdir(output, { recursive: true });
function freeze(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/(?:\/[\w-]+)*\/_astro\//g, '../../../../dist/_astro/')
    .replace(/<link[^>]+(?:fonts\.googleapis|fonts\.gstatic)[^>]*>/g, '')
    .replaceAll('loading="lazy"', 'loading="eager"');
}
const home = freeze(await readFile('dist/index.html', 'utf8'));
const pages = {};
for (const id of ['robot-cat', 'animal-puzzle']) {
  pages[id] = freeze(await readFile(`dist/models/${id}/index.html`, 'utf8'));
}
const manifest = { kind: 'programmatic layout studies: spatial prototype and fallback; not browser evidence', frames: [] };
async function frame(name, html, width, height, css = '') {
  const filename = `${name}-${width}x${height}.html`;
  const style = `<style>html,body{width:${width}px;height:${height}px;overflow:hidden;margin:0}body{scroll-behavior:auto}${css}</style>`;
  await writeFile(`${output}/${filename}`, html.replace('</head>', `${style}</head>`));
  manifest.frames.push({ name, filename, width, height });
}
for (const [width, height] of [[1440, 900], [1920, 1080]]) {
  for (const id of Object.keys(pages)) {
    const catalog = '.home-story{display:none!important}.site-header{position:relative!important}';
    await frame(`${id}-M01`, home, width, height, catalog);
    await frame(`${id}-M02-fallback`, home, width, height, `${catalog}body{opacity:.45}`);
    await frame(`${id}-M03-fallback`, pages[id], width, height, 'body{opacity:.55}');
    await frame(`${id}-M04`, pages[id], width, height);
    await frame(`${id}-return`, home, width, height, catalog);
    // The implemented fallback has no crop change: both documents retain
    // their exact media geometry. Check both sides of the visibility handoff.
    await frame(`${id}-handoff-before`, home, width, height, `${catalog}body{opacity:.1}`);
    await frame(`${id}-handoff-after`, pages[id], width, height, 'body{opacity:.1}');
    // Separate spatial studies calculate actual boxes from frozen markup in
    // same-origin srcdoc frames. They are layouts, never runtime evidence.
    for (const [name, time] of [['M01', 0], ['M02', 90], ['crop-before', 139],
      ['crop-after', 141], ['M03', 280], ['M04', 420]]) {
      const filename = `${id}-spatial-${name}-${width}x${height}.html`;
      const source = home.replace('</head>', `<style>${catalog}</style></head>`);
      const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
      const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Макет ${id} ${name}</title>
        <style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#0d0d12}iframe{position:absolute;inset:0;border:0;width:100%;height:100%;pointer-events:none}#subject{position:absolute;max-width:none;object-fit:fill;pointer-events:none}</style>
        <iframe id="source" title="Исходный макет" srcdoc="${escape(source)}"></iframe>
        <iframe id="target" title="Целевой макет" srcdoc="${escape(pages[id])}"></iframe><img id="subject" alt="">
        <script>${geometryCode}
        const frames=[document.getElementById('source'),document.getElementById('target')];
        const ready=frame=>new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
        Promise.all(frames.map(ready)).then(async()=>{
          const [a,b]=frames.map(frame=>frame.contentDocument);
          const oldImage=a.querySelector('[data-model-id="${id}"] img'),newImage=b.querySelector('.cover img');
          await Promise.all([oldImage.decode(),newImage.decode()]);
          const measure=image=>imageGeometry(image.getBoundingClientRect(),image.parentElement.getBoundingClientRect(),image.naturalWidth,image.naturalHeight,getComputedStyle(image).objectFit);
          const start=measure(oldImage),end=measure(newImage),time=${time};
          // Invert the x axis of cubic-bezier(.22,1,.36,1).
          const cubic=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
          let low=0,high=1;for(let n=0;n<32;n++){const mid=(low+high)/2;if(cubic(mid,.22,.36)<Math.min(1,time/360))low=mid;else high=mid;}
          const p=cubic((low+high)/2,1,1),mix=(x,y)=>x+(y-x)*p;
          oldImage.style.visibility=newImage.style.visibility='hidden';
          frames[0].style.opacity=String(Math.max(0,1-time/180));
          frames[1].style.opacity=String(Math.min(1,time/180));
          const oldTitle=a.querySelector('[data-model-id="${id}"] [data-model-title]'),newTitle=b.querySelector('.model-head [data-model-title]');
          const from=oldTitle.getBoundingClientRect(),to=newTitle.getBoundingClientRect();
          oldTitle.style.visibility=newTitle.style.visibility='hidden';
          for(const [element,rect,opacity] of [[oldTitle,from,Math.max(0,1-time/180)],[newTitle,to,Math.max(0,Math.min(1,(time-40)/280))]]){
            const text=document.createElement('div'),style=getComputedStyle(element);
            text.textContent=element.textContent;
            const scale=Math.min(mix(from.width,to.width)/rect.width,mix(from.height,to.height)/rect.height);
            text.style.cssText='position:absolute;pointer-events:none;overflow:hidden;left:'+mix(from.left,to.left)+'px;top:'+mix(from.top,to.top)+'px;width:'+rect.width+'px;height:'+rect.height+'px;transform-origin:top left;transform:scale('+scale+');opacity:'+opacity+';font:'+style.font+';line-height:'+style.lineHeight+';letter-spacing:'+style.letterSpacing+';color:'+style.color;
            document.body.append(text);
          }
          const subject=document.getElementById('subject');subject.src=newImage.currentSrc;
          subject.style.cssText='position:absolute;max-width:none;left:'+mix(start.left,end.left)+'px;top:'+mix(start.top,end.top)+'px;width:'+mix(start.width,end.width)+'px;height:'+mix(start.height,end.height)+'px;clip-path:inset('+start.inset.map((n,i)=>mix(n,end.inset[i])+'%').join(' ')+')';
        });</script></html>`;
      await writeFile(`${output}/${filename}`, html);
      manifest.frames.push({ name: `${id}-spatial-${name}`, filename, width, height, time });
    }
  }
  const state = homeMotionState(.9);
  const properties = { catHeight: ['--cat-height', '%'], catX: ['--cat-x', '%'],
    catBottom: ['--cat-bottom', '%'], printerScale: ['--printer-scale', ''],
    doorDetail: ['--door-detail', ''], printerOpacity: ['--printer-opacity', ''],
    workshopOpacity: ['--workshop-opacity', ''], warmth: ['--warmth', ''],
    reflection: ['--reflection', ''], introOpacity: ['--intro-opacity', ''], captionOpacity: ['--caption-opacity', ''] };
  const rules = Object.entries(properties).map(([key, [property, unit]]) => `${property}:${state[key]}${unit}`).join(';');
  const hero = home.replace('<html lang="ru"', '<html lang="ru" class="home-motion"')
    .replace(/data-home-motion\b/, 'data-home-motion data-ready')
    .replace(/data-stage\b/, `data-stage style="${rules}"`)
    .replace(/data-src="([^"]+)"/g, 'src="$1"');
  const heroCSS = `.site-header,.home-models,.site-footer{display:none!important}.home-story,.home-hero{height:${height}px!important;min-height:0!important}.home-hero{position:relative!important}`;
  await frame('hero-H04', hero, width, height, heroCSS);
  const middleFile = `hero-overlap-middle-${width}x${height}.html`;
  const escapeAttribute = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const oldHero = hero.replace('</head>', `<style>${heroCSS}</style></head>`);
  await writeFile(`${output}/${middleFile}`, `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Макет середины перекрытия hero</title><style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#0d0d12}iframe{position:absolute;inset:0;border:0;width:100%;height:100%;opacity:.5;pointer-events:none}</style><iframe title="Hero H04" srcdoc="${escapeAttribute(oldHero)}"></iframe><iframe title="Обложка модели" srcdoc="${escapeAttribute(pages['robot-cat'].replace('</head>', '<style>.model-head{opacity:0}</style></head>'))}"></iframe></html>`);
  manifest.frames.push({ name: 'hero-overlap-middle', filename: middleFile, width, height, time: 140 });
  await frame('hero-handoff-before', hero, width, height, `${heroCSS}body{opacity:.1}`);
  await frame('hero-handoff-after', pages['robot-cat'], width, height, 'body{opacity:.1}');
  await frame('hero-final', pages['robot-cat'], width, height);
}
for (const id of Object.keys(pages)) await frame(`${id}-static`, pages[id], 390, 844);
await writeFile(`${output}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
await writeFile(`${output}/index.html`, `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Макеты внутренних переходов</title><style>body{font:16px/1.5 system-ui;margin:32px;background:#121217;color:#eee}a{color:#ffbc36}li{margin:12px 0}</style><h1>Макеты: пространственный прототип и fallback</h1><p>Программные этюды из текущей сборки с реальными текстами и медиа. Это не скриншоты браузера. Геометрия каталога условно зафиксирована в начале раздела. Пространственные этюды измеряют frozen DOM в srcdoc и интерполируют геометрию; это не запись нативного перехода. Визуальная приёмка ещё не выполнена. Для медиа нужна папка dist из той же сборки.</p><ul>${manifest.frames.map(f => `<li><a href="${f.filename}">${f.name} · ${f.width}×${f.height}</a></li>`).join('')}</ul></html>`);
console.log(`Wrote ${manifest.frames.length} frozen layout studies to ${output}`);
