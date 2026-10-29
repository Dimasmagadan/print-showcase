# Robot-cat redesign — acceptance record

2026-10-24. Local implementation and available-environment checks complete. This is a new redesign record, not inherited acceptance from the previous two-chapter story. Nothing published.

Safari is **untested**: Safari 26.5 WebDriver rejected session creation because “Allow remote automation” was disabled. The user explicitly chose **“Continue and record Safari as untested”**. No Safari screenshots or compatibility claims are made.

## Visual/story requirements (§11)

| Requirement | Evidence / result |
|---|---|
| Problem, three parts, print positions, connection and replacement readable visually | New K0–K8 storyboard/contact sheet, portrait studies, short prototype, final production captures. One body throughout. |
| K3 has a source beyond STL placement | README orientation table + recipe `print_pose()` + historical slicing record, documented in implementation.md. |
| K2/K3 one episode, no separate lateral move for text | Common grouped episode; camera/part transforms occur together while parts rotate; no extra shift-only reading interval. Mobile has two separate views in the same group. |
| Time bars share one scale, 840:165 | CSS short bar is 19.6428571429%; constant HTML values and construction/settings qualification beside them. |
| K4 genuinely close; visible pin and seating before pullback | K4 capture and private recipe: legs seat before zoom; head seating occupies the first half of K4→K5 with camera fixed, pullback follows. |
| K5 does not announce the rabbit | K5 is the assembled cat and “Голова снимается”; bunny hidden at its endpoint. Caption/leader leave before removal. |
| K6 image precedes explanation; old face/connection explained after seating | Incoming head appears during 76–84%; reveal copy starts after 84% with scroll-based fade; detailed K7 copy starts after seating. |
| Mobile one body, both heads, exposed connection and path | Dedicated 780×1000 portrait, with static replacement arrows and pin marker. Loaded-image phone captures and no-JS capture. |
| K8 real assembled photo with frame/texture | Existing sanitized 02.jpg, visually inspected; K8 captures show complete real robot and print layers. |
| One body at assembly/replacement boundary | Single Body and Legs objects in recipe; one canvas/stage and continuous sequence; recording covers transition. |
| The same connection remains the visual anchor after K5 | No independent chapter restart; head paths clear the same fixed pin. |
| No empty canvas or cropped active part | Last successful pose is retained while new media loads; leg seating occurs before close crop; K6 both heads complete. Lower body crop is confined to intentional approach/close-up; incoming head is intentionally partial before reveal. |
| No model/camera drift on reading holds | Frozen keyframe indices on holds; reversible state tests; recording. Browser sampling also confirms leader-first appearance and identical frame/caption opacity after stopping scroll. Text fades derive only from scroll. |
| No light/background/geometry discontinuity | Shared scene/material/lights/floor and continuous camera transforms. Final contact review caught and corrected 12 dark intermediates; all 85 now pass brightness verification (minimum 102,809 bright pixels) and visual inspection. |
| Plaques avoid details; leader endpoint follows feature | Projected pin/head coordinates, shared canvas/leader composition box; main captures at 1440 and 1920. Leader fades before head moves. |
| Composition varies with purpose | Central K0/K2/K5/K6/K7, right-shifted K1 under left text, K3 result right, K4 close-up with right plaque. |
| Final impression is real object and painting | K7 exits naturally into the separate real photo; no repeated comparison panel. Gallery and lightbox remain available. |

## Browser matrix

Browsers actually exercised: Chromium/Chrome 156.0.8078.47 and Firefox Developer Edition 152.0b10, geckodriver 0.37.1.

| CSS viewport | Chrome | Firefox |
|---|---|---|
| 1440×900 | Motion, captures, forward/reverse recording | Motion, captures |
| 1920×1080 | Motion, captures | Motion, captures |
| 1024×768 | Complete flow; actual text-fit check rejects motion | Complete flow; actual text-fit check rejects motion |
| 390×844 | Complete portrait flow; zero sequence requests | Complete portrait flow |
| 360×640 | Complete portrait flow; zero sequence requests | Complete portrait flow |

No horizontal overflow in these checks. Firefox's two phone sizes use exact-size same-origin browsing frames because its native window enforces a 500 px minimum width; this is desktop Firefox at those CSS viewports, not a claim about Android Firefox. Desktop Firefox dimensions use native windows.

Raw results: [Chrome matrix](acceptance/chrome-matrix.json), [final compiled matrix/no-JS](acceptance/chrome-final-matrix.json), [Firefox matrix](acceptance/firefox/matrix.json), [Firefox reduced-motion matrix](acceptance/firefox/reduced.json).

## Runtime, navigation and accessibility

| Check | Evidence / result |
|---|---|
| State / fallback / loader automated tests | 66 tests pass in `npm test`; new tests cover holds, reverse/deep entry, reveal fade, eligibility, byte capacity, manifest validation, stale work, request bounds, failure and resize preservation. |
| Forward/reverse playback and real-photo exit | Final 1440 recording visits all 85 frames, reaches all of K8, returns to frame/copy K0. [Recording](acceptance/recordings/chrome-forward-reverse-1440.webm), [metrics](acceptance/chrome-scroll.json). |
| Resource bounds | Observed 64,000,000 controlled decoded-frame bytes / three requests; decoding reservations included. Not total process RAM. |
| Resize | K3 → 1024 flow lands at 32 px reading offset → desktop restores frame 36. Local offset-based fit avoids native fragment-scroll measurement races. |
| Enlarged text | Root font 32 px triggers complete flow with same stage at ~32 px, no overflow. |
| Native 200% zoom | Firefox's isolated browser UI set to 2×; CSS viewport becomes 720×450 at DPR 2, complete flow, no horizontal overflow. [Result](acceptance/firefox/zoom-200.json), screenshot alongside it. Chrome also passed the equivalent 720×450 / DPR 2 layout with zero frame requests ([result](acceptance/chrome-zoom-and-hold.json)); its synthetic shortcut did not activate browser-UI zoom and is not claimed as that UI test. |
| Reduced motion | Chrome zero sequence requests; Firefox all five viewport sizes flow. |
| JavaScript disabled | Compiled phone page has all eight HTML stages, loaded portrait images, no motion/sequence requests or horizontal overflow. Canvas is decorative. |
| Single frame 404 | Injected frame 049 failure + delayed static poster: same K4 recovered at 32 px with decoded poster and visible text, not page start. Last canvas/copy held until poster decode. |
| Slow network + rapid scroll | 150 ms per frame request; jumps .8→.25→.95 reach final frame 84 without mode failure, requests remain ≤3. |
| Back/Forward | Return to K3 restores frame 36 and exact scroll position (delta 0). |
| Fresh middle entry | `#robot-key-4` reaches and keeps frame 48, including normal and BASE production builds. |
| Home and catalog entry | Both real links in compiled home page enter robot-cat with cover/title contract and exactly one story scene. |
| Keyboard / lightbox | Enter on skip link reaches photo section; gallery Enter opens dialog, Escape closes and restores button focus. |
| Focus / semantics | No scroll-driven focus operations or live region; single H1, ordered HTML facts, meaningful alternatives and a skip link. |
| Ordinary and BASE builds | Both pass; compiled playback/deep entry works under both prefixes with no failed local resources. |
| No public geometry or recipes | Dist audit finds zero STL/3MF/GLB/GLTF/BLEND/Python files; browser receives only raster media. |
| Other pages / shared transitions | Six other pages match HEAD baseline after asset-content normalization; model cover/title identifiers unchanged. Entry tests pass. |

Raw cases: [failure/resize/slow network](acceptance/chrome-edge-cases.json), [navigation/keyboard](acceptance/chrome-navigation.json), [compiled prefix and entry](acceptance/chrome-compiled-and-entry.json), [normal build](acceptance/build-root.json), [BASE build](acceptance/build-prefixed.json), [other pages](acceptance/other-pages.json), [media inventory](acceptance/media.json).

## Artifacts and limits

- Final K0–K8 production captures: `acceptance/K*-1440.png`; Chrome desktop 1920 captures and Firefox captures are alongside their reports.
- Flow captures: `acceptance/flow-K*-{1024,390,360}.png`; final no-JS image and Firefox native zoom image are saved separately.
- New composition/contact sheet: `storyboard/contact-sheet.webp`; independent portrait sources and composition studies under `storyboard/mobile/` and `storyboard/mobile-composition-*.png`.
- Short K2→K7 prototype and transition inspection: `prototype/`. Earlier `draft-*` files are historical studies, not final acceptance.

Safari and native Chrome browser-UI zoom were not exercised; native 200% zoom was exercised in Firefox. No physical print/slicer rerun, total browser-process memory benchmark, publication or user copy approval is claimed. Those limits do not change the explicit user-approved Safari exception or the completed local implementation scope.
