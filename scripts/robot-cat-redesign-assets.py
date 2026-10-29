"""Package private renders and create composition studies (not acceptance screenshots)."""
from pathlib import Path
import json
import io
from PIL import Image, ImageOps
ROOT = Path(__file__).resolve().parents[1]
WORK = Path('/tmp/print-showcase-robot-story/redesign')
OUT = ROOT / 'docs/design/robot-cat-redesign/storyboard'
OUT.mkdir(parents=True, exist_ok=True)
def write_asset(path, data):
    if path.exists() and path.read_bytes() == data:
        return
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_bytes(data)
    temporary.replace(path)

for source in sorted((WORK / 'storyboard').glob('*.png')):
    with Image.open(source) as im:
        bg = Image.new('RGBA', im.size, '#0D0D12')
        bg.alpha_composite(im.convert('RGBA'))
        bg.convert('RGB').save(OUT / f'{source.stem}.webp', quality=85)
anchors = json.loads((WORK / 'storyboard/anchors.json').read_text())
copy = [
('Робот для дочки', 'Дочка любит мультфильм про трёх котов, и я сделал ей робота оттуда. Первую версию — без колёс: сначала хотелось проверить саму фигурку.'),
('Цельную модель пришлось бы печатать с поддержками', 'Под головой, руками и хвостом понадобились бы поддержки. Слайсер оценил печать примерно в 14 часов. Я не стал печатать цельную модель и переделал конструкцию.'),
('Разделил на три детали', 'Голова · Корпус с руками и хвостом · Ноги'),
('Каждая деталь — в своём положении', 'Голова — плоским низом, корпус — на спине, ноги — на ступнях. После изменения конструкции и настроек расчётное время сократилось. Собрать три детали проще, чем очищать цельную фигурку от поддержек.'),
('Без клея', 'Голова садится на штырь на корпусе.'),
('Голова снимается', ''),
('Допечатал только новую голову', ''),
('Тот же робот. Теперь с заячьими ушами', 'Лицо и крепление прежние; корпус и ноги перепечатывать не пришлось.'),
('Дальше — раскрасить', 'Печатал светлым пластиком, чтобы дочка могла раскрасить робота сама. На животе оставил рамку под рисунок маркером.')]
css = '''*{box-sizing:border-box}body{margin:0;background:#0d0d12;color:#f5f5f7;font:18px/1.6 Inter,system-ui}header{padding:32px 48px}h1{font-size:28px}h2{font-size:clamp(28px,3.2vw,48px);line-height:1.1;margin:0 0 20px}p{margin:0;max-width:38ch}small{color:#b0b1bb}section{position:relative;width:100%;aspect-ratio:1.6;border-bottom:1px solid #30313a;overflow:hidden}section>img{width:100%;height:100%;object-fit:contain}article{position:absolute;left:4%;top:7%;width:31%}section[data-k="0"] article{width:35%}section[data-k="2"] article,section[data-k="6"] article,section[data-k="7"] article{width:90%;top:4%;text-align:center}section[data-k="2"] p,section[data-k="7"] p{max-width:none}section[data-k="6"] article{top:auto;bottom:12%;left:5%;width:25%;text-align:left}section[data-k="6"] h2{font-size:32px}section[data-k="7"] article{width:32%;text-align:left}section[data-k="3"] article{left:auto;right:4%;width:27%;top:18%}section[data-k="3"] h2{font-size:32px}section[data-k="4"] article,section[data-k="5"] article{left:auto;right:5%;top:24%;width:20%;padding:20px;background:#18191f;border:1px solid #30313a;border-radius:9px}section[data-k="4"] h2,section[data-k="5"] h2{font-size:24px}section[data-k="5"] article{left:6%;right:auto;top:16%}.times{margin-top:24px}.times label{display:block}.bar{height:7px;background:#ffbc36;margin:8px 0 16px}.short{width:19.642857%}svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}path{stroke:#b0b1bb;stroke-width:1.5;fill:none}circle{fill:#ffbc36}.photo{display:flex;align-items:center;gap:8%;padding:48px}.photo>img{width:45%;height:90%;object-fit:contain}.photo article{position:static;width:40%}.transitions{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:32px}.transitions img{width:100%}a{color:#ffbc36}@media(max-width:700px){header{padding:20px}section{aspect-ratio:auto;padding:20px}section>img{height:auto}article,section[data-k] article{position:static;width:100%;padding:0;text-align:left;margin:20px 0;background:none;border:0}h2,section[data-k="3"] h2{font-size:30px}svg{display:none}.photo{display:block}.photo>img{width:100%}}'''
html = '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Robot-cat — новый storyboard</title><style>'+css+'</style><header><h1>Один робот, одна история</h1><small>Композиционный этюд K0–K8. Не приёмка сайта. Текст — черновик для вычитки.</small></header>'
for k,(title,body) in enumerate(copy):
    image = f'K{k}.webp' if k < 8 else '../../../../src/content/models/robot-cat/photos/02.jpg'
    html += f'<section data-k="{k}" class="'+('photo' if k==8 else '')+f'"><img src="{image}" alt="Опорный кадр K{k}"><article><h2>{title}</h2><p>{body}</p>'
    if k == 3: html += '<div class="times"><label>≈14 ч</label><div class="bar"></div><label>≈2 ч 45 мин</label><div class="bar short"></div><small>Оценки слайсера. Изменились конструкция и настройки печати.</small></div>'
    html += '</article>'
    if k in (4,5):
        x,y = anchors[f'K{k}']['pin' if k==4 else 'head']
        x,y = x*16,y*10
        origin = '1200 330 L 1200 650' if k==4 else '416 200 L 530 200'
        html += f'<svg viewBox="0 0 1600 1000"><path d="M {origin} L {x} {y}"/><circle cx="{x}" cy="{y}" r="4"/></svg>'
    if k == 1:
        html += '<svg viewBox="0 0 1600 1000">'
        for x,y in anchors['K1']['zones']:
            x,y = x*16,y*10
            html += f'<path d="M 560 730 L 650 730 L {x} {y}"/><circle cx="{x}" cy="{y}" r="4"/>'
        html += '</svg>'
    html += '</section>'
html += '<header><h2>Связки — промежуточные состояния</h2></header><div class="transitions">'
for source in sorted(OUT.glob('*mid.webp')): html += f'<figure><img src="{source.name}" alt="{source.stem}"><figcaption>{source.stem}</figcaption></figure>'
html += '</div></html>'
(OUT / 'index.html').write_text(html)
print('Packaged storyboard:', len(list(OUT.glob('*.webp'))))
# Portrait controls are composed independently; never crop the landscape scene.
mobile = OUT / 'mobile'
mobile.mkdir(exist_ok=True)
for source in sorted((WORK / 'mobile').glob('*.png')):
    with Image.open(source) as im:
        bg = Image.new('RGBA', im.size, '#0D0D12')
        bg.alpha_composite(im.convert('RGBA'))
        bg.convert('RGB').save(mobile / f'{source.stem}.webp', quality=85)
portrait = html.split('<header><h2>Связки')[0]
for k in range(8): portrait = portrait.replace(f'src="K{k}.webp"', f'src="mobile/K{k}.webp"')
portrait += '</html>'
(OUT / 'mobile.html').write_text(portrait)

proto = ROOT / 'docs/design/robot-cat-redesign/prototype'
proto.mkdir(exist_ok=True)
for source in sorted((WORK / 'prototype').glob('*.png')):
    with Image.open(source) as im:
        bg = Image.new('RGBA', im.size, '#0D0D12')
        bg.alpha_composite(im.convert('RGBA'))
        bg.convert('RGB').save(proto / f'{source.stem}.webp', quality=82)
# The prototype consumes compiled copies of the same state/pool modules as production.
(proto / 'index.html').write_text('''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>K2→K7 — scroll prototype</title><style>'''+css+'''
header{min-height:30vh}.track{height:600vh}.stage{position:sticky;top:0;height:100vh;overflow:hidden}canvas{position:absolute;width:100%;height:100%;object-fit:contain}.stage article{z-index:1;left:5%;top:8%;width:30%}.stage article h2{font-size:clamp(24px,3vw,46px)}.stage[data-key="3"] article{left:auto;right:4%;width:26%;top:18%}.stage[data-key="4"] article{left:auto;right:5%;width:20%;background:#18191f;padding:20px;border:1px solid #30313a;border-radius:9px;top:24%}.stage[data-key="5"] article{left:6%;top:16%;width:20%;padding:20px;background:#18191f;border:1px solid #30313a;border-radius:9px}.stage[data-key="4"] h2,.stage[data-key="5"] h2{font-size:26px}.stage[data-key="6"] article{top:auto;bottom:12%;width:25%}.status{position:absolute;bottom:12px;left:20px;font-size:12px;color:#b0b1bb}
</style><header><h1>Печатные положения → соединение → новая голова</h1><p>Короткий прототип. Прокрутка вперёд и назад управляет одной сценой. Черновая частота: 6 кадров на связку.</p><a href="../storyboard/index.html">Контактный лист</a> · <a href="../storyboard/mobile.html">Портретный монтаж</a></header><div class="track"><div class="stage"><canvas width="1600" height="1000" aria-hidden="true"></canvas><article></article><svg viewBox="0 0 1600 1000" aria-hidden="true"><path id="leader"/><circle id="anchor" r="4"/></svg><span class="status">Подготовка кадров…</span></div></div><header><h2>Дальше — раскрасить</h2><p>Конец тестовой связки. Итоговая страница ещё не заменена.</p></header><script type="module">
import {redesignState} from './state.js';
import {RedesignFramePool} from './pool.js';
const anchors='''+json.dumps(anchors,ensure_ascii=False)+''';
const copy='''+json.dumps(copy, ensure_ascii=False)+''';
const track=document.querySelector('.track'), stage=document.querySelector('.stage'), canvas=document.querySelector('canvas'), ctx=canvas.getContext('2d'), article=document.querySelector('article'), status=document.querySelector('.status');
let frame=0, last=-1, raf=0;
const pool=new RedesignFramePool({fetch:window.fetch.bind(window),decode:window.createImageBitmap.bind(window)},1600,1000,invalidate,()=>{status.textContent='Ошибка кадра. Доступен контактный лист.';pool.clear()});
const url=i=>new URL(String(i).padStart(3,'0')+'.webp',location.href).href;
function invalidate(){if(!raf)raf=requestAnimationFrame(draw)}
function draw(){raf=0;const top=track.getBoundingClientRect().top;const p=Math.max(0,Math.min(1,-top/(track.offsetHeight-innerHeight)));const state=redesignState(.27+p*.73,6);frame=Math.max(0,Math.min(30,state.frame-12));const direction=frame<last?-1:1;const near=[frame];for(let i=1;i<=4;i++){if(frame+i*direction>=0&&frame+i*direction<=30)near.push(frame+i*direction);if(frame-i*direction>=0&&frame-i*direction<=30)near.push(frame-i*direction)}pool.plan(near.map(url));const image=pool.get(url(frame));if(image){ctx.drawImage(image,0,0);last=frame;stage.dataset.key=state.key;article.innerHTML=state.copy===null?'':`<h2>${copy[state.copy][0]}</h2><p>${copy[state.copy][1]}</p>`;if(state.copy===3)article.innerHTML+='<div class=times><label>≈14 ч</label><div class=bar></div><label>≈2 ч 45 мин</label><div class="bar short"></div><small>Оценки слайсера. Изменились конструкция и настройки печати.</small></div>';article.style.opacity=state.opacity;const svg=document.querySelector('svg');svg.style.opacity=(state.copy===4||state.copy===5)?state.opacity:0;if(state.copy===4||state.copy===5){const point=anchors['K'+state.copy][state.copy===4?'pin':'head'];document.querySelector('#leader').setAttribute('d',`M ${state.copy===4?'1200 330 L 1200 650':'416 200 L 530 200'} L ${point[0]*16} ${point[1]*10}`);document.querySelector('#anchor').setAttribute('cx',point[0]*16);document.querySelector('#anchor').setAttribute('cy',point[1]*10)}status.textContent=`K${state.key} → K${state.next} · кадр ${frame}/30 · ${(pool.bytes/1048576).toFixed(1)} MiB · пик ${(pool.peakBytes/1048576).toFixed(1)} MiB · запросы ${pool.peakRequests}`;stage.dataset.frame=frame}}
addEventListener('scroll',invalidate,{passive:true});addEventListener('resize',invalidate);addEventListener('pagehide',()=>pool.clear());invalidate();
</script></html>''')
print('Packaged portrait/prototype:', len(list(mobile.glob('*.webp'))), len(list(proto.glob('[0-9][0-9][0-9].webp'))))

# Static production posters are always available, even before sequence packaging.
posters = ROOT / 'src/assets/robot-cat-redesign'
posters.mkdir(parents=True, exist_ok=True)
for k in range(8):
    for prefix, folder in [('', OUT), ('mobile-', mobile)]:
        source = folder / f'K{k}.webp'
        if source.exists():
            write_asset(posters / f'{prefix}K{k}.webp', source.read_bytes())
write_asset(ROOT / 'src/content/robot-cat-redesign-anchors.json', (json.dumps(anchors, indent=2) + '\n').encode())
write_asset(ROOT / 'src/content/robot-cat-redesign-mobile-anchors.json', (WORK / 'mobile/anchors.json').read_bytes())
sequence = sorted((WORK / 'sequence').glob('[0-9][0-9][0-9].png'))
if len(sequence) == 85:
    target = ROOT / 'public/media/robot-cat-story/v2'
    (target / 'frames').mkdir(parents=True, exist_ok=True)
    sizes = []
    for i, source in enumerate(sequence):
        assert source.stem == f'{i:03}'
        with Image.open(source) as im:
            assert im.size == (1600, 1000)
            bg = Image.new('RGBA', im.size, '#0D0D12')
            bg.alpha_composite(im.convert('RGBA'))
            bright = sum(ImageOps.grayscale(bg.convert('RGB')).histogram()[101:])
            assert bright >= 10_000, f'{source}: visible light PLA missing ({bright} bright pixels)'
            destination = target / f'frames/{i:03}.webp'
            buffer = io.BytesIO()
            bg.convert('RGB').save(buffer, format='WEBP', quality=82)
            write_asset(destination, buffer.getvalue())
            sizes.append(destination.stat().st_size)
    manifest = dict(version=2, width=1600, height=1000, framesPerTransition=12,
                    frames=[f'frames/{i:03}.webp' for i in range(85)], bytes=sizes, totalBytes=sum(sizes))
    write_asset(target / 'manifest.json', (json.dumps(manifest, indent=2)+'\n').encode())
    print('Production sequence:', len(sizes), sum(sizes), 'bytes')
