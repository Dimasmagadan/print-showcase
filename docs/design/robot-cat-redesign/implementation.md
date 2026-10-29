# Robot-cat redesign — implemented locally

Completed 2026-10-24. Implements `../robot-cat-redesign-spec.md`; nothing pushed or published. New copy remains subject to the user's normal review before publication. Safari is explicitly untested at the user's request after WebDriver reported that remote automation was disabled.

Local production previews:

- http://127.0.0.1:8768/models/robot-cat/
- http://127.0.0.1:8768/print-showcase/models/robot-cat/ (BASE build)
- Development: http://127.0.0.1:4324/models/robot-cat/
- [Storyboard](storyboard/index.html), [portrait compositions](storyboard/mobile.html), [K2→K7 prototype](prototype/index.html).

## Implemented story

The two chapters and separate comparison have been replaced by one stage spanning K0–K7. Camera framing, part transforms, frame selection, captions and leaders follow one deterministic scroll timeline. K1 shows the actual overhang zones; K2 separates three parts; K3 places them in confirmed printing positions and shows proportional time bars; K4 seats the head in close-up before pulling back; K5 holds the assembled cat; K6 reveals the new head before its explanation; K7 keeps one body and both heads. The stage then scrolls out into the real photo, rather than resetting to the cat.

The default HTML is the entire flowing story. It also serves phones, reduced motion, missing JS/bitmap support, failed media and enlarged text. Mobile K2/K3 share a grouped episode with separate assembly and printing views. Portrait K6 shows one body, both complete heads, the exposed pin and replacement paths. Images precede explanations; source dimensions reserve the correct portrait space before decoding. K8 uses the existing assembled-robot photo, with its own edges and caption. The filament incident is ordinary compact text; specifications, gallery and discussion remain accessible.

## Verified sources

- `../3dprint/exports/robot_cat/README.md`, «Детали и ориентация»: head on its flat base with ears up; body on its back with frame up; legs standing on their feet. This confirms the poses independently of STL placement.
- `../3dprint/models/robot_cat.py`, `print_pose()`: head translated −96 mm; body rotated −90° around X and translated +16 mm in Z; legs unchanged. Display spacing is separate from those physical orientations.
- `../3dprint/SPEC_robot_cat_split.md`, §9: historical geometry checks and per-part slicing. No new physical print or slicing is claimed here. The public facts remain light PLA and rounded slicer estimates of 840 and 165 minutes, with construction/settings qualification.
- `src/content/models/robot-cat/photos/02.jpg` was visually inspected and used for K8: assembled light robot, belly frame and visible print texture. The head-only photo is not used as the ending.
- Assembly-coordinate meshes were read from `/tmp/print-showcase-robot-story/{Head,Body,Legs,HeadBunny}.stl`. Neighbour repository was read only. Geometry and private render PNGs stay outside the public build.

## Chosen parameters

- Landscape raster: 1600×1000, 85 WebP frames, 12 samples per transition; Cycles, 16 samples with denoising. Separate portrait controls: 780×1000; compact K3 print layout: 780×650.
- One material, fixed area lights, fixed camera direction and shadow-catching floor. The packaged background is `#0D0D12`. No invented supports, printer or workshop.
- General vertical camera field: 0.25 m; K4: 0.14 m, selected after checking the pin and head gap at full viewport size. The lower body intentionally leaves the close-up. Head seating finishes before camera pullback. Legs seat in the wider view before that close-up begins.
- Scene height: 700svh, including a 100svh sticky stage; active travel is six viewport heights. Timeline reading holds are defined in `robot-cat-redesign-state.ts`, following §7. No wheel capture, snapping, autoplay, focus movement or `aria-live`.
- Canvas and leaders share the same 1.6:1 composition box; leader endpoints are projected from the actual camera/geometry. Lines lead the caption fade. Copy fades are scroll-defined, including the reveal caption; a stopped scroll does not run a timer.
- Motion eligibility starts at 1024×700, normal motion and successful decode, then checks actual text fit. 1440×900 and 1920×1080 use motion. At 1024×768 K3 does not fit, so the full flowing version is selected. Font enlargement and resize recheck this condition.
- Resize preserves the current reading stage. Failed frames freeze the last painted pose/copy while the static poster decodes, then collapse to the same stage in flow. Cancelled fetch/decode work cannot reactivate the old mode. Fresh semantic hash entry and Back/Forward restoration were verified.

## Media and runtime

Authoritative inventory: [acceptance/media.json](acceptance/media.json).

| Item | Bytes |
|---|---:|
| All 85 sequence frames | 925,100 |
| Sixteen source posters, landscape + portrait | 169,208 |
| All 18 image files/variants referenced by the story, including existing reference/photo | 1,029,468 |
| All narrative images plus sequence | 1,954,568 |
| Story entry + controller runtime, raw / gzip | 9,275 / 4,093 |

The loader derives capacity from resolution: `floor(64 MiB / (width × height × 4))`, ten frames at 1600×1000. Cache entries and in-flight decodes share that limit; requests are limited to three, including jobs that have not yet settled after cancellation. Nearby frames are prepared in travel order. Sequence loading starts only near the scene; phones and reduced-motion mode request no sequence frames.

The recorded production run reached all 85 frames, entered K8 fully, returned to K0 and matched its caption. Peak controlled bitmap accounting was 64,000,000 bytes (61.0 MiB), with three requests. Maximum sampled rAF interval was 9.4 ms in this local Chromium run. This is decoded-frame accounting and an observed local run, not total browser-process memory or a universal device-performance claim. See [metrics](acceptance/chrome-scroll.json) and [forward/reverse recording](acceptance/recordings/chrome-forward-reverse-1440.webm).

The old v1 assets (595,502 frame bytes) remain for previously cached pages and historical tests; the new page requests v2. Asset replacement is atomic and skips unchanged production files to avoid partial image responses during local regeneration.

## Files and reproduction

Production changes:

- `src/components/RobotCatStory.astro`, `src/styles/robot-cat-story.css`, `src/content/robot-cat-story.ts`.
- `src/scripts/robot-cat-redesign.ts`, `robot-cat-redesign-state.ts`, `robot-cat-redesign-pool.ts`.
- `src/content/robot-cat-redesign-{anchors,mobile-anchors}.json`, `src/assets/robot-cat-redesign/`, `public/media/robot-cat-story/v2/`.
- `scripts/robot-cat-redesign-{render,assets}.py`, `robot-cat-redesign-verify.mjs`, `robot-cat-redesign-webdriver.py`, `robot-cat-redesign.test.mjs`; test command in `package.json`.

Private four-part geometry can be recreated using the existing `scripts/robot-cat-story-export.py` workflow described in the previous story spec. The new recipe reads those meshes; it never exports geometry into public assets. Then render controls (`--samples 16`), portraits (`--mobile`), the short prototype (`--prototype`) and finally the sequence (`--sequence --samples 16`). Run `python3 scripts/robot-cat-redesign-assets.py` to package. In this implementation the corrected short prototype was reviewed before the full sequence was rendered. Sandbox startup required approved Blender execution outside the sandbox.

Checks:

```sh
npm test
npm run build
node scripts/robot-cat-redesign-verify.mjs
BASE=/print-showcase/ npm run build -- --outDir /tmp/robot-cat-redesign-prefixed-host/print-showcase
node scripts/robot-cat-redesign-verify.mjs /tmp/robot-cat-redesign-prefixed-host/print-showcase /print-showcase/
```

66 tests pass. Both builds and media/build audits pass. The verifier checks every frame's path, bytes, 1600×1000 dimensions and visible-PLA brightness, eight ordered HTML stages, shared transition identifiers, BASE paths, and absence of geometry/recipes in dist. Other six pages match a HEAD baseline build after asset URLs are normalized by file content hashes; only an asset basename changed. [Evidence](acceptance/other-pages.json).

Browser results and the exact Safari exception are in [acceptance.md](acceptance.md). Old `draft-*` studies and earlier screenshots are retained as work history; final production checkpoints are under `acceptance/`. No required local implementation work remains. Publication and user copy approval were not performed.

### Final lighting correction

The final 85-frame contact inspection found twelve dark intermediate renders (37, 39, …, 59) that were not caught by valid dimensions/bytes or browser frame-index checks. They were re-rendered with persistent render caching disabled and individually inspected; the final sequence has at least 102,809 pixels above luminance 100 in every frame. Packaging and dist verification now reject frames with fewer than 10,000 such pixels. A regression test rejects a fully dark, otherwise valid WebP. Sharp 0.35.5 is declared directly as a dev dependency for this verification. Earlier recordings were replaced after this correction.
