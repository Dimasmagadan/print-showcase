# Home motion: current evidence and remaining acceptance

22 October 2026. Local implementation only; no push or publication.

## Review artifacts

- [Contact sheet and frozen HTML layouts](review/index.html): H01–H04 and before/after frames at both joins, at 1440×900 and 1920×1080. Static layouts: 1440×900, 390×844 and 360×800.
- [Raster contact sheet](review/contact-sheet.png) and full-size PNG files beside it. These are composition studies rendered from the shared geometry and photo mask, **not browser screenshots**. Their text wrapping, tint and reflection are approximate. Frozen HTML uses the production CSS; Inter falls back to a system font when not installed locally.
- [Frame values and artifact manifest](review/manifest.json). Reproduce with `npm run review:home`.

The layouts were inspected as raster studies. That found and corrected a floating-subject error in H02: the subject now shares the printer's scale and zoom origin until 45%, then aligns with the table during the environment change. Static desktop framing was restored to a contained, right-aligned illustration. Browser composition remains unaccepted.

## Implementation evidence

| Requirement | Current evidence | Remaining evidence |
| --- | --- | --- |
| Real subject; four frames and two joins | Original-photo pixels, shared `home-cat-mask.ts`, HTML/PNG artifacts | Native mask and edge rendering in browsers |
| Printer → approach → table | One persistent subject layer, progress-only state, shared camera invariant test, door-frame SVG | Actual continuous forward/reverse scroll, printer sharpness and perspective |
| Entire cat, feet and table contact in H04 | Full-size H04 study; separate shadows following photographed feet | Real-frame appearance at both design sizes and DPR 2 |
| Static cat/printer, current page structure | Full static HTML; contained desktop framing and adjusted mobile crop | Actual narrow-screen/JS-off rendering |
| Independent catalog and immediate skip | Single `#models`, native fragment links; no wheel interception or timers | Anchor/reload/Back in browsers |
| Pinned published hero; no draft leak | Ordering tests and missing/draft integration builds; subject-keyed media registry | Browser smoke check of resulting catalog |
| Conditional enhancement | Early head check, width and height limits, reduced-motion/API/media checks | Actual thresholds and ±1 px cases |
| Resize/focus robustness | Controller tests retain catalog offset; focused final link transfers to its ordinary model card | Keyboard/zoom/resize in a rendering engine |
| Static resource budget | Workshop and detail are data-src; static mode does not call decode/load | Browser network capture in static, JS-off and reduced-motion modes |
| BASE and internal-page isolation | Prefixed build and URL/file checks; scene script only belongs to home component | Model/gallery browser smoke check |
| Copy review; no publication | New strings listed below; local worktree only | User copy edits, if any, before any future publication task |

## Automated checks

`npm test`: 11 passing tests. These cover newer content/missing/draft ordering, input immutability, shared camera/bed contact, absent ResizeObserver, separate first-frame/deferred decode failures, reversible seek, intro/final focus, live reduced motion, catalog offset retention and deferred activation after fragment/restored navigation, and viewport revalidation on pageshow after a cached return. The controller runs in a small DOM harness; these tests do not prove layout or browser compatibility.

`npm run build`: passes, 7 pages. `BASE=/print-showcase/ npm run build`: passes. Generated prefixed assets exist, model/catalog links carry the prefix, the homepage has exactly one H1 and one catalog, the default HTML has no active motion class, and deferred layers have no src. Missing/draft integration builds passed with the expected warning, no dedicated scene/final link, and no draft catalog link; source edits used for these checks were restored.

## Working settings and media

- Working threshold: 1280×800 CSS px. Not yet a browser-accepted threshold.
- Stage: 100svh; section: 300svh; active travel: two stage heights. Approach 15–45%, environment 45–70%, caption 60–72%; final pose held through 100% by scroll distance.
- H01 subject: 27% of scene-world height, center x 71.5%, bottom 27%. Zoom origin 71.5% / 59%; maximum scale 2.55. H04: height 67%, center x 65%, bottom 12%.
- Scene world preserves 16:9 and fits inside the viewport. Final viewBox height is about 543 CSS px at 1440×900 and 724 px at 1920×1080. DPR 2 needs about 1448 pixels at the larger size; the prepared photo silhouette has about 1450 useful vertical pixels without upscaling.
- Photo: 260,514 bytes; largest printer WebP: 45,778 bytes; combined first frame: 306,292 bytes. Deferred workshop: 106,300 bytes. Door-frame SVG is a small inline data URL in the HTML. These are build-file sizes, not measured transfers.
- Printer/workshop backgrounds were prepared earlier with built-in image generation. The door-frame detail is hand-authored SVG traced in the printer image's coordinates. The source photograph and original printer illustration remain untouched. No generated subject pixels are used.
- Door rails stay vector-sharp, but the rest of the enlarged printer remains the original raster illustration. The close-up's optical quality and angle are specifically pending visual acceptance.

User browser review: overall appearance accepted; requested the final caption to begin while the printer is still visible. Caption reveal now runs from 60–72%, overlapping the printer fade ending at 70%. This feedback does not establish which individual matrix cases were exercised.

## Browser matrix: outstanding

The Browser runtime returned “No browser is available”; discovery returned an empty list. No Chrome, Firefox or Safari check is claimed. Browser connection was requested so the following can proceed:

| Case from §13 | Status |
| --- | --- |
| 1440×900, 1920×1080 | HTML/PNG studies prepared; runtime pending |
| 1366×768, 1280×800 and ±1 px on both axes | Runtime pending |
| 1024×768, 768×1024, 390×844, 360×800 | Static HTML implemented; overflow/visibility pending |
| 1920×700 | Static condition implemented; runtime pending |
| Resize at H02/H04/catalog | Controller path tested; layout/position pending |
| Fast forward/reverse scroll and H03 stop | Seek tested; runtime pending |
| Anchor, reload, Back | Controller guards tested; real restoration timing pending |
| Reduced motion, JS off, media errors | Markup/controller checks passed; browser rendering/network pending |
| Tab/Enter/PageDown, 200% zoom | Focus logic tested; real keyboard and viewport behavior pending |
| Chrome, Firefox, Safari | All pending; Safari remains mandatory |
| Newer model and missing/draft hero | Automated checks passed |
| Model page/gallery regression | Source isolation checked; browser smoke check pending |

Still needed: native screenshots, network measurements, forward/reverse scroll recording, final threshold/timing decisions and any resulting fixes. The user performed a general browser review and reported the result was generally good. The requested caption timing adjustment is implemented and checked automatically. Detailed matrix results and a native scroll recording remain undocumented; the agent still has no browser connection for those checks. The existing local preview was revalidated with HTTP 200.

## Local review and copy

Dev server confirmed at `http://127.0.0.1:4322/`. New strings for proofreading: «Из принтера — в реальный мир» and «История модели →». The final title comes from model content. Publication is outside this task.
