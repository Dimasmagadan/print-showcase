# print-showcase

Сайт-витрина моделей из репо `../3dprint`. Astro, статика, GitHub Pages.

## Добавить модель

```bash
npm run import -- <model_id> --photos ~/path/to/photos
```

- `model_id` — папка в `../3dprint/exports/`.
- Скрипт создаёт `src/content/models/<slug>/index.md` с `draft: true`,
  забирает рендеры `preview/*.png`, размер из STL, материал и слой из `meta.json`.
- Фото пережимаются до 2400 px и теряют EXIF (геометку тоже).
- Модели, README и рецепты сюда не копируются — сайт только показывает.

Дальше: дописать `summary` и текст «Идея / Как делал / Печать», выбрать `cover`,
поставить `draft: false`.

Повторный запуск с новыми `--photos` докладывает фото и печатает YAML для `gallery`,
не трогая готовый текст.

## Видео

Короткий таймлапс (≤15 МБ) — в `public/video/<slug>.mp4`, в frontmatter
`video: /video/<slug>.mp4`. Длинное — на YouTube / VK Видео / Rutube,
в `video:` ссылка.

```bash
ffmpeg -i in.mp4 -vf "scale=-2:720" -c:v libx264 -crf 28 -preset slow -an -movflags +faststart out.mp4
```

## Локально

```bash
npm install
npm run dev       # http://localhost:4321
npm run build
```

Ссылки на канал и контакт — `src/config.ts`.

## Деплой

Push в `main` → GitHub Actions собирает и публикует. В настройках репо:
Settings → Pages → Source: GitHub Actions.
