# Robot-cat story — реализация

Дата: 2026-10-23. Ветка: `feat/home-motion`.
**Реализовано, визуальная приёмка не завершена.** Пользователь принял семь контрольных
кадров: «все супер». Массовый рендер выполнен после этого ответа.
Локальная страница: http://127.0.0.1:4324/models/robot-cat/ . Публикации и push не было.

## Этапы A–F

- [x] A: прочитаны ограничения/спецификации и исходный код из §2, проверены ветка/status.
  Исходные 37 тестов и обе сборки проходили. Чужие `.claude/` и
  `scripts/__pycache__/` не менялись. Исходная спецификация была untracked.
- [x] A: baseline HTML/ассетов вне dist: `/tmp/print-showcase-robot-story/baseline/dist/`,
  перечень `baseline/assets.json`, журнал `baseline/prefixed-build.log`.
- [x] B: экспорт четырёх настоящих объектов; семь контрольных WebP; осмотр;
  композиционные HTML-макеты 1440×900/390×844; ответ пользователя получен.
- [x] C: статическая история S1–S7, фото/постеры/характеристики/сравнение;
  один H1, прежние header/cover/галерея/lightbox, условные ссылки.
  Старый markdown-рассказ заменён комментарием; frontmatter не менялся.
  Новые тексты собраны в одном `src/content/robot-cat-story.ts`.
- [x] D, реализация: сначала 40 split-кадров, контроллер и 14 новых автотестов;
  после их прохождения — 40 swap-кадров и проверка обеих глав тем же контроллером.
  Одна общая очередь/LRU, canvas, безопасный manifest, сравнение вне timeline.
- [x] E, автоматическая часть: 54 теста (37 прежних + 17 новых), обе сборки,
  проверка dist/BASE/ссылок и сравнение baseline проходят.
- [ ] D/E, браузерная часть: реальный scroll/sticky, S3 относительно паузы,
  размеры/фокус/навигация/ошибки/сеть и браузеры из §10; запись и снимки сайта.
- [x] F, документация: команды, версии, размеры, источники, изменённые файлы,
  честная матрица приёмки и статус в спецификации/CLAUDE.md.
- [ ] F, полная приёмка: только после недостающих браузерных доказательств.

## Окружение и воспроизведение

Node v26.8.2; Python экспорта 3.14.7, build123d 0.11.1 из соседнего `.venv`;
Blender 5.2.0 LTS (fbe6228777e7); системный Python с Pillow 12.3.0.
В соседнем `.venv` Pillow отсутствует: упаковка запускается системным Python.
Рабочие STL/PNG/измерения/логи находятся только в `/tmp/print-showcase-robot-story/`.

```sh
# Только чтение рецептов соседнего репозитория; вывод — в /tmp.
PYTHONDONTWRITEBYTECODE=1 ../3dprint/.venv/bin/python scripts/robot-cat-story-export.py
# Контрольные кадры (без --sequence); до массового рендера нужен просмотр §6.2.
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python scripts/robot-cat-story-render.py
python3 scripts/robot-cat-story-assets.py
# Последовательности: сначала split, проверка, затем swap.
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python scripts/robot-cat-story-render.py -- --sequence split
python3 scripts/robot-cat-story-assets.py --sequence split
node --test scripts/robot-cat-story.test.mjs
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python scripts/robot-cat-story-render.py -- --sequence swap
python3 scripts/robot-cat-story-assets.py --sequence swap
# Проверки (verify требует сохранённого baseline A в /tmp).
npm test
npm run build
node scripts/robot-cat-story-verify.mjs
BASE=/print-showcase/ npm run build
BASE=/print-showcase/ node scripts/robot-cat-story-verify.mjs
git diff --check
npm run dev -- --host 127.0.0.1 --port 4324
```

Blender внутри sandbox аварийно завершился; локальные рендеры запущены с одобренным
доступом вне sandbox. Первая проба compositor использовала удалённый в Blender 5.2
`Scene.node_tree`: заменена прозрачным PNG и alpha composite в Pillow. Пересвет
лица исправлен до показа контроля пользователю. Эти ошибки устранены.
Рецепты соседнего репозитория не вызывают main(), make, export или сохранение сцены;
импорт не пишет pycache. Все четыре STL получены в сборочной, не печатной позе.

## Источники медиа

| Медиа | Источник/обработка |
| --- | --- |
| Обложка 02.jpg, галерея | Прежние данные контента, без изменения |
| S1, референс из раскраски | Существующий `photos/03.jpg`, Astro Image; подпись референса |
| S6, фото головы | Существующий `photos/01.jpg`, Astro Image; настоящая печать |
| Split: кот/корпус/ноги | `robot_cat.build()` и `write_stl()` из read-only `../3dprint/models` |
| Swap: голова зайца | `robot_cat_bunny.build_head_bunny()` и тот же `write_stl()` |
| Все новые WebP | Локальный Blender Cycles, одна камера/свет/материал; Pillow quality 80 |
| Постеры | Те же файлы, что split/000, split/039, swap/039; совпадение байтов проверяется тестом |
| Контроль/контактные листы/макеты | `review/`, локальные производные рендеров; **не снимки сайта** |

В public только 80 WebP и manifest.json. Никаких CAD, рабочих PNG, .blend, Python,
Three.js, GLB/GLTF, роутера, HyperFrames, видео или сторонних платных API.

## Геометрия и движение

Масштаб STL 0.001. Матовый светлый пластик, фон #0D0D12. Cycles 32 samples + denoise,
800×1000, AgX. `geometry.json` в /tmp хранит bounds/число треугольников четырёх объектов.
Направление камеры `(0.16, -0.5, 0.17)`, центр `(0.001438, -0.003864, 0.100286)` м.
`ortho_scale = 0.2995989621` м. Объединённые bounds в координатах камеры:
`[-0.04830343, -0.03768376, -0.03203972]` →
`[0.04868746, 0.22596332, 0.10166629]` м. Поле по высоте — 6% с каждого края
относительно объединения; ширина также вписана. Камера и свет не меняются.

Split: голова +38 мм, ноги −30 мм, корпус неподвижен. В разнесённом состоянии
низ головы 134 мм, верх шеи 108 мм; верх ног 11 мм, низ корпуса ≈23 мм:
штыри освобождаются. Сборка — тот же ряд кадров в обратном порядке.

Swap: голова кота поднимается на q=0–0.25; q=0.25–0.40 головы расходятся к ±85 мм;
q=0.40–0.55 кот уходит дальше влево, заяц пока справа; q=0.55–0.75 заяц приходит
на ось шеи; q=0.75–1 опускается. Боковой уход 269.639 мм. Минимальное расстояние
центров при совместной видимости — 170 мм против ширины каждой головы 68 мм:
головы и уши не пересекаются. Корпус/ноги неподвижны. Начала split/swap совпадают
побайтно. Осмотрен [лист всех 80 кадров](review/sequences.webp), в том числе середина
замены; конечные уши/лицо не обрезаны. Это не доказывает качество реального scroll.

## Вёрстка, progress и ресурсы

Контракт режима находится в одном CSS media query: ≥1280×800 и no-preference.
TS читает computed `--story-motion`, не дублирует размеры. В других режимах главы
без grid/sticky/75svh, split-постер после S3, bunny-постер после трёх абзацев S5.
Desktop sticky существует и без JS: top 32px, visual height 100svh − 64px.
Readiness/ошибка меняют только canvas, не геометрию. Текст всегда виден.

Чистая state-функция реализует таблицы §7 без изменения интервалов:
split 0–.15 assembled, .15–.32 разборка, .32–.65 пауза, .65–.83 сборка, .83–1 пауза;
swap 0–.18 кот, .18–.65 замена через smoothstep, .65–1 заяц. Progress считается
по wrapper правой колонки, без заголовка главы.

В S5 три читаемых шага по min-height 75svh: wrapper минимум 225svh, расчётный
scroll-ход — **125svh + 64px** (132.111svh/1189px при 900px высоты;
130.926svh/1414px при 1080px). Это расчёт CSS, **не браузерное измерение**.
Итоговую длину и совпадение S3 с паузой ещё нужно измерить в браузере, в том числе
при длинном тексте/шрифтовой подстановке; шаги имеют auto height, а не обрезку.

Контроллер: lazy import после root; manifest за один viewport до главы; swap-кадры
только около swap. Passive scroll → один RAF, без постоянного цикла. Fetch → bitmap
→ один drawImage, предыдущий кадр остаётся до готовности нужного. Async учитывает
epoch и текущий план кадров; готовность инвалидирует RAF без нового scroll-event.
Общие лимиты: три fetch/decode и восемь живых/зарезервированных bitmap; LRU.close(),
±2 соседа с направлением. При соседних главах приоритет отдаётся восьми наиболее
нужным кадрам: две группы по пять не создают цикл взаимного вытеснения.
Disable/pagehide отменяют RAF, abort запросы и закрывают bitmap; запоздалый decode
закрывается. Pageshow использует сохранённый нативный scroll, без нового контроллера.
Story не меняет history, focus, scrollRestoration и не перехватывает ввод.

Сравнение независимо: после decode обоих постеров доступны кнопки с aria-pressed;
без JS/при decode-ошибке — оба подписанных изображения. Переключение мгновенное.
Размеры сетки постеров одинаковы до/после инициализации; место кнопок зарезервировано
padding, их появление не сдвигает дальнейшее чтение. Браузерный фокус ещё не проверен.

## Размеры и доказательства

- Split: 40 файлов, **292 442 байта**. Swap: 40, **303 060 байт**.
  Вместе **595 502 байта** против бюджета 6 MB; manifest отдельно.
- Постеры: кот 6560, разборка 7616, заяц 7256 байт (каждый <180 KB).
- Prefixed story runtime: **6342 байта**, gzip 2588; bootstrap/preload helper
  **1865 байт**, gzip 942. Gzip — расчёт файлов, не измерение HTTP transfer/RSS.
- [54 теста](checks/tests.txt): state/границы/обратимость, lazy/no-motion/root,
  late decode и late manifest, ошибки, disable/pagehide/pageshow, лимиты и close(),
  обе последовательности, сравнение, manifest/файлы/размеры/постеры.
- [Root-аудит](checks/root.json), [prefixed-аудит](checks/prefixed.json): семь страниц,
  106 локальных ссылок, 80 файлов, отсутствие запрещённых форматов.
- [Обычная сборка](checks/build.txt), [BASE-сборка](checks/prefixed-build.txt).
- Главная и пять остальных моделей совпадают с baseline по HTML/CSS/контенту после
  исключения внешних module script-тегов. При смене BASE имена WebP изменяются;
  verifier сравнивает их по SHA-256 реальных байтов, сохраняя остальные атрибуты.
  Отдельно совпадают header, cover, gallery, lightbox robot-cat. Общие переходы не правились.

## Ограничение браузерной проверки и следующий шаг

Навык Browser прочитан и применён заново. Runtime: `getForUrl(...)` →
`No browser is available`; после bootstrap-troubleshooting вызов browsers.list() → `[]`.
Это новая проверка доступности, а не ссылка на прежние ограничения переходов.
HTTP страницы на 4324 проверен: 200 OK. HTTP не доказывает layout или работу JS.

Снимки сайта, запись двух глав, network, реальные viewport/zoom/keyboard/history,
Chrome/Safari/Firefox не получены. Матрица [acceptance.md](acceptance.md) оставлена
незавершённой; не считать рендеры и DOM harness её заменой. Следующее действие:
при доступном браузере выполнить строки §10, измерить swap/S3, исправить найденное
и только после этого закрывать полную приёмку.

## Изменённые файлы

- `src/pages/models/[slug].astro`, body `src/content/models/robot-cat/index.md`.
- `src/components/RobotCatStory.astro`, `src/content/robot-cat-story.ts`,
  `src/styles/robot-cat-story.css`, `src/scripts/robot-cat-story{,-state}.ts`.
- `src/assets/robot-cat-story/` — три постера; `public/media/robot-cat-story/v1/`
  — manifest и split/swap по 40 WebP.
- `scripts/robot-cat-story-{export,render,assets}.py`,
  `scripts/robot-cat-story.test.mjs`, `scripts/robot-cat-story-verify.mjs`, `package.json`.
- Эта документация, acceptance/checks/review, `robot-cat-story-spec.md`, `CLAUDE.md`.
