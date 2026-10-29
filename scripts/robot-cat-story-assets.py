"""Package control renders or a sequence/manifest. Only finished WebP enters public/."""
from pathlib import Path
import argparse
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
WORK = Path('/tmp/print-showcase-robot-story')
parser = argparse.ArgumentParser()
parser.add_argument('--sequence', choices=['split', 'swap'])
args = parser.parse_args()

def convert(source, destination):
    with Image.open(source) as image:
        assert image.size == (800, 1000), source
        background = Image.new('RGBA', image.size, '#0d0d12')
        background.alpha_composite(image.convert('RGBA'))
        background.convert('RGB').save(destination, quality=80)

def sequence_sheet(bundle):
    rows = [sorted((bundle / name).glob('*.webp')) for name in ('split', 'swap')]
    if not all(len(row) in (40, 60) for row in rows):
        return
    row_counts = [(len(row) + 9) // 10 for row in rows]
    sheet = Image.new('RGB', (1600, sum(row_counts) * 224), '#0d0d12')
    draw = ImageDraw.Draw(sheet)
    offset = 0
    for name, sources, height in zip(('split', 'swap'), rows, row_counts):
        for i, source in enumerate(sources):
            with Image.open(source) as image:
                image.thumbnail((160, 200))
                x, y = i % 10 * 160, (offset + i // 10) * 224
                sheet.paste(image, (x, y + 24))
                draw.text((x + 6, y + 4), f'{name} {source.stem}', fill='white')
        offset += height
    sheet.save(ROOT / 'docs/design/robot-cat-story/review/sequences.webp', quality=85)

if args.sequence:
    bundle = ROOT / 'public/media/robot-cat-story/v1'
    target = bundle / args.sequence
    target.mkdir(parents=True, exist_ok=True)
    sources = sorted((WORK / args.sequence).glob('*.png'))
    assert len(sources) in (40, 60), f'Unexpected frame count: {len(sources)}'
    assert [s.stem for s in sources] == [f'{i:03}' for i in range(len(sources))]
    for source in sources:
        convert(source, target / f'{source.stem}.webp')
    manifest_path = bundle / 'manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else dict(version=1, width=800, height=1000, sequences={})
    frames = [f'{args.sequence}/{s.stem}.webp' for s in sources]
    sizes = [(bundle / path).stat().st_size for path in frames]
    manifest['sequences'][args.sequence] = dict(frames=frames, count=len(frames), bytes=sizes, totalBytes=sum(sizes))
    manifest['totalBytes'] = sum(s['totalBytes'] for s in manifest['sequences'].values())
    assert manifest['totalBytes'] <= 6_000_000, 'Frame budget exceeded'
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    posters = ROOT / 'src/assets/robot-cat-story'
    posters.mkdir(parents=True, exist_ok=True)
    endpoints = {'assembled-cat': sources[0], 'exploded-cat': sources[-1]} if args.sequence == 'split' else {'assembled-bunny': sources[-1]}
    for name, source in endpoints.items():
        path = posters / f'{name}.webp'
        convert(source, path)
        assert path.stat().st_size <= 180_000
    print(args.sequence, len(frames), sum(sizes), 'bytes; bundle', manifest['totalBytes'])
    sequence_sheet(bundle)
    raise SystemExit(0)

OUT = ROOT / 'docs/design/robot-cat-story/review'
OUT.mkdir(parents=True, exist_ok=True)
for source in sorted((WORK / 'control').glob('*.png')):
    with Image.open(source) as image:
        background = Image.new('RGBA', image.size, '#0d0d12')
        background.alpha_composite(image.convert('RGBA'))
        background.convert('RGB').save(OUT / (source.stem + '.webp'), quality=80)
comparison = Image.new('RGB', (1600, 1000), '#0d0d12')
for x, name in [(0, '01-assembled-cat'), (800, '06-assembled-bunny')]:
    with Image.open(OUT / f'{name}.webp') as image:
        comparison.paste(image, (x, 0))
comparison.save(OUT / '07-comparison.webp', quality=80)
sheet = Image.new('RGB', (1200, 1100), '#0d0d12')
draw = ImageDraw.Draw(sheet)
for i, source in enumerate(sorted(OUT.glob('0*.webp'))):
    with Image.open(source) as image:
        image.thumbnail((290, 470))
        x, y = (i % 4) * 300, (i // 4) * 550
        sheet.paste(image, (x, y + 32))
        draw.text((x + 8, y + 8), source.stem, fill='white')
sheet.save(OUT / 'contact-sheet.webp', quality=85)
# These are static composition studies, explicitly not browser screenshots.
for width, height in [(1440, 900), (390, 844)]:
    (OUT / f'layout-{width}x{height}.html').write_text('''<!doctype html><html lang="ru"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Композиционный макет — не браузерная проверка</title>
<style>*{box-sizing:border-box}body{margin:0;background:#0d0d12;color:#f5f5f7;font:18px/1.65 system-ui}main{max-width:1440px;margin:auto;padding:48px}h1{font-size:32px}h2{font-size:22px}p{max-width:65ch}section{display:grid;grid-template-columns:45fr 55fr;gap:48px}figure{margin:0;position:relative}img{width:100%;max-height:736px;object-fit:contain}.badge{position:absolute;bottom:16px;left:16px;color:#b0b1bb;font-size:13px}strong{color:#ffbc36}@media(max-width:1279px){body{font-size:16px}main{padding:20px}section{display:block}}</style>
<main><small>Композиционный макет, не снимок сайта</small>
<h1>От цельной модели к трём деталям</h1><section><div>
<h2>Три детали — проще печатать</h2>
<p>Я разделил робота на голову, корпус и ноги. Каждая часть печатается в своём положении, поэтому поддержки больше не нужны. Голову печатаю соплом 0,4 мм, корпус и ноги — 0,6 мм.</p>
<p>После изменения конструкции и настроек расчётное время сократилось примерно до 2 часов 45 минут. А собрать три детали проще, чем очищать цельную фигурку от поддержек.</p>
<strong>≈14 ч → ≈2 ч 45 мин</strong><p>Оценки слайсера для двух вариантов конструкции и настроек печати</p>
</div><figure><img src="02-exploded-cat.webp" alt="Голова, корпус и блок ног разнесены по вертикали"><span class="badge">рендер</span></figure></section></main></html>''')
(OUT / 'index.html').write_text('''<!doctype html><html lang="ru"><meta charset="utf-8"><title>Robot-cat: контроль геометрии</title><style>body{background:#0d0d12;color:#f5f5f7;font:16px system-ui}img{max-width:100%;max-height:85vh}a{color:#ffbc36}</style><h1>Контроль геометрии — этап B</h1><p>Локальные рендеры Blender. Не браузерная приёмка сайта.</p>''' + ''.join(f'<figure><img src="{p.name}" alt="{p.stem}"><figcaption>{p.stem}</figcaption></figure>' for p in sorted(OUT.glob('0*.webp'))) + '<a href="layout-1440x900.html">Макет 1440×900</a> · <a href="layout-390x844.html">Макет 390×844</a></html>')
