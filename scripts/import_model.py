"""Импорт модели из основного репо 3dprint в витрину.

    npm run import -- robot_cat --photos ~/Pictures/robot-cat
    npm run import -- animal_puzzle --extra animal_puzzle_tray   # две модели на одной странице

Берёт из ../3dprint/exports/<id>/ только meta.json, рендеры preview/ и размеры
из STL. Фото пережимаются (≤2400 px, JPEG) и теряют EXIF — включая геометку.
STL/3MF, README и рецепты в витрину не попадают.

Если index.md уже есть, он не перезаписывается (кроме --force): скрипт
докладывает новые медиа и печатает YAML для gallery.
"""

import argparse
import json
import shutil
import struct
import sys
from pathlib import Path

from PIL import Image, ImageOps

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = ROOT.parent / "3dprint"
SKIP_RENDERS = ("checkpoint",)  # служебные кадры проверок, не для витрины
PHOTO_EXT = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"}
MAX_SIDE = 2400


def stl_bounds(path: Path) -> tuple[list[float], list[float]] | None:
    """Границы бинарного STL без сторонних зависимостей."""
    data = path.read_bytes()
    if len(data) < 84:
        return None
    (n,) = struct.unpack_from("<I", data, 80)
    if 84 + n * 50 != len(data):
        return None  # ASCII STL — пропускаем
    lo = [float("inf")] * 3
    hi = [float("-inf")] * 3
    for i in range(n):
        off = 84 + i * 50 + 12
        for v in range(3):
            xyz = struct.unpack_from("<3f", data, off + v * 12)
            for a in range(3):
                lo[a] = min(lo[a], xyz[a])
                hi[a] = max(hi[a], xyz[a])
    return lo, hi


def model_size(export: Path, objects: list[dict]) -> tuple[float, ...] | None:
    """Общий габарит всех деталей в их координатах из экспорта.

    Если детали в STL разложены для печати, а не собраны, число будет
    габаритом раскладки — его стоит проверить глазами.
    """
    lo = [float("inf")] * 3
    hi = [float("-inf")] * 3
    found = False
    for o in objects:
        stl = export / o["file"]
        b = stl_bounds(stl) if stl.suffix.lower() == ".stl" and stl.exists() else None
        if b:
            found = True
            lo = [min(x, y) for x, y in zip(lo, b[0])]
            hi = [max(x, y) for x, y in zip(hi, b[1])]
    return tuple(h - l for l, h in zip(lo, hi)) if found else None


def fmt_mm(v: float) -> str:
    return f"{v:.0f}"


def save_photo(src: Path, dst: Path) -> None:
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((MAX_SIDE, MAX_SIDE))
        im.save(dst, "JPEG", quality=88, optimize=True, progressive=True)


def yaml_str(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("model_id", help="папка в exports/, например robot_cat")
    p.add_argument("--photos", type=Path, help="папка с фотографиями напечатанной модели")
    p.add_argument("--src", type=Path, default=DEFAULT_SRC, help=f"основной репо (по умолчанию {DEFAULT_SRC})")
    p.add_argument("--extra", nargs="*", default=[], help="доп. модели из exports/ на ту же страницу (их рендеры)")
    p.add_argument("--force", action="store_true", help="перезаписать index.md")
    args = p.parse_args()

    export = args.src / "exports" / args.model_id
    meta_path = export / "meta.json"
    if not meta_path.exists():
        print(f"нет {meta_path}", file=sys.stderr)
        return 1
    meta = json.loads(meta_path.read_text())
    slug = meta.get("slug") or args.model_id.replace("_", "-")
    out = ROOT / "src" / "content" / "models" / slug
    (out / "renders").mkdir(parents=True, exist_ok=True)

    gallery: list[tuple[str, str]] = []  # (относительный путь, kind)

    if args.photos:
        (out / "photos").mkdir(exist_ok=True)
        existing = len(list((out / "photos").glob("*.jpg")))
        files = sorted(f for f in args.photos.iterdir() if f.suffix.lower() in PHOTO_EXT)
        for i, f in enumerate(files, start=existing + 1):
            dst = out / "photos" / f"{i:02d}.jpg"
            save_photo(f, dst)
            gallery.append((f"./photos/{dst.name}", "photo"))
        print(f"фото: {len(files)} → {out / 'photos'}")

    for src_id, prefix in [(args.model_id, "")] + [(e, f"{e}-") for e in args.extra]:
        preview = args.src / "exports" / src_id / "preview"
        if not preview.is_dir():
            print(f"нет {preview}", file=sys.stderr)
            return 1
        for f in sorted(preview.glob("*.png")):
            if f.name.startswith(SKIP_RENDERS):
                continue
            name = prefix + f.name
            shutil.copy2(f, out / "renders" / name)
            gallery.append((f"./renders/{name}", "render"))

    photos = [g for g, k in gallery if k == "photo"]
    renders = [g for g, k in gallery if k == "render"]
    cover = photos[0] if photos else next((r for r in renders if r.endswith("iso.png")), renders[0] if renders else None)
    if cover is None:
        print("нет ни фото, ни рендеров — нечем делать обложку", file=sys.stderr)
        return 1

    gallery_yaml = "\n".join(
        f"  - src: {g}\n    alt: {yaml_str(meta['title'] + (' — фото' if k == 'photo' else ' — рендер'))}\n    kind: {k}"
        for g, k in gallery
    )

    index = out / "index.md"
    if index.exists() and not args.force:
        print(f"{index} уже есть, не трогаю. Новые элементы gallery:\n{gallery_yaml}")
        return 0

    objects = meta.get("objects") or []
    printing = meta.get("print") or {}
    specs: list[str] = []
    material = printing.get("material") or (objects[0].get("material") if objects else None)
    if material:
        specs.append(f"  material: {material}")
    if objects:
        size = model_size(export, objects)
        if size:
            specs.append(f"  size: {yaml_str(' × '.join(fmt_mm(v) for v in size) + ' мм')}")
        parts = sum(o.get("qty", 1) for o in objects)
        if parts > 1:
            specs.append(f"  parts: {parts}")
    layer = printing.get("layer_mm") or printing.get("layer_height_mm")
    if layer:
        specs.append(f"  layer: {yaml_str(str(layer).replace('.', ',') + ' мм')}")

    front = f"""---
title: {yaml_str(meta['title'])}
summary: ""  # одно предложение для карточки и превью в соцсетях
date: {meta.get('created', '')}
tags: {json.dumps(meta.get('tags', []), ensure_ascii=False)}
cover: {cover}
coverAlt: {yaml_str(meta['title'])}
gallery:
{gallery_yaml}
specs:
{chr(10).join(specs) or '  {}'}
# video: /video/{slug}.mp4  или ссылка на YouTube / VK / Rutube
# tgPost: https://t.me/CHANNEL/123
draft: true
---

## Идея

Зачем понадобилась вещь.

## Как делал

Моделирование, примерки, что переделывал.

## Печать

Ориентация, поддержки, сколько попыток.
"""
    index.write_text(front)
    print(f"черновик: {index}\nдопиши summary и текст, затем поставь draft: false")
    return 0


if __name__ == "__main__":
    sys.exit(main())
