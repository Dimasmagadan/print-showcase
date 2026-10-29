# Home motion implementation log

Branch: `feat/home-motion`. Specification: `../home-motion-spec.md`.

## Preparation

- Read `CLAUDE.md` and the complete motion specification.
- User selected the dark workshop direction. The tone decision is resolved; H04 is not visually finalized. Work is currently paused at the user's request. The current status and remaining checklist are recorded in `../home-motion-spec.md`.
- Source photo: `src/content/models/robot-cat/photos/02.jpg`; original preserved. Generated extraction trials changed subject details and were rejected. The prototype displays the original photo through the SVG silhouette in `CatPhoto.astro`; the mask still needs edge cleanup. Background media used the built-in imagegen tool, not a paid API/CLI workflow.
- Original printer illustration remains untouched.
- Browser runtime connected, but discovery returned no available browsers. Baseline screenshots and browser acceptance are still pending; build output is not visual acceptance.

## Resolution plan (before making scene media)

At 1920×1080, DPR 2, a subject occupying 67% of scene height needs 1448 source pixels vertically. The source photo has approximately 1700 subject pixels, so use the extracted subject at native resolution without upscaling. Keep this as one persistent layer throughout the transition to avoid a double silhouette.

A printer occupying 50% of the scene width needs 1920 source pixels at DPR 2 in H01. At 2.5× zoom it would need 4800 pixels if it remained visible. Prepare a separate door detail, or remove the printer from view before exceeding its native resolution; verify the actual crop at H02/H03 before selecting the final media.

## Implemented and checked

- `src/home-featured.ts` is the home subject configuration and catalog ordering function. Missing/draft subjects return an ordinary published catalog; the home page emits a build/dev warning.
- `getModels()` and other consumers retain their existing behavior.
- `node --test scripts/home-featured.test.mjs`: passed, covering a newer publication, missing/draft subject, date order and input immutability.
- `npm run build`: passed after the catalog change.
- Static hero markup and its existing styles are now isolated in `src/components/HomeHero.astro`; the build also passes after this extraction. Browser comparison remains pending.
- Card hover scaling is restricted to the `home-motion` enhancement class; static mode retains ordinary hover/focus states without scaling, as §8 requires.

## Subject extraction trial

Built-in imagegen produced `rejected/cat-cutout-v1.png` from the source photograph. Prompt requested a transparent cutout preserving the entire cat, photographic pixels, proportions, camera angle, layer lines, natural color and shading, removing only the wall/table and extraneous object, without upscaling. The result is **rejected**: visible edge residue and changes to eye/arm geometry violate subject fidelity. It is not imported by the site and is not production media. The next extraction must preserve the source subject exactly; do not use this candidate as a photographic final.

## Prototype added after the tone decision

- `HomeMotionHead.astro` and the named head slot in `Base.astro` reserve the section before first paint when preliminary conditions pass.
- `home-motion-state.ts` defines progress-only motion; `home-motion.ts` implements loading, scroll updates, fallback, resize and focus handling. Runtime behavior remains unverified in browsers.
- Initial thresholds: 1280×800 CSS px; sticky scene 100svh, section 300svh. These are not accepted final thresholds.
- `HomeHero.astro` composes the empty printer, original-photo subject, dark table background, local reflection and final content title/link. Subject masking, contact shadow and printer sharpness need work.
- Added backgrounds: `src/assets/hero/robot-cat/printer-empty-v1.png` and `workshop-empty-v1.png`, both 1672×941. No high-resolution door detail yet.
- Last prototype build passed: 7 pages. Generated WebP files: subject 601,184 bytes, largest printer candidate 45,778 bytes, deferred workshop 106,300 bytes. First-frame subject + printer exceeds the 500 KB target; actual network requests are not measured.

## Still required

Clean the subject mask; finalize H04 contact/composition and H01–H03 continuity; resolve printer zoom resolution; prepare H01–H04 mockups, contact sheet, transition controls and recording; validate all browser/fallback/resize/focus/navigation cases; confirm media/config association on a future hero change; optimize and measure network budgets; check `/print-showcase/` URLs; update `CLAUDE.md` and the acceptance report. Nothing has been pushed or published.

The previous tone blocker is resolved. Work is paused by the user, not blocked on a color decision. Browser acceptance still requires an available browser connection. This remains an incomplete implementation, not a visual acceptance result.


## Resumed implementation — 22 October 2026

Work resumed on the user's implementation request. Earlier references to a pause describe the previous session, not the current status.

- Added `src/home-featured-media.ts`, a subject-keyed media registry. Both early mode selection and scene rendering require a reviewed bundle for the configured ID. An unknown ID cannot reuse robot-cat media.
- Guarded ResizeObserver construction when the API is absent. A failed deferred layer now explicitly selects the emergency visual. Already-failed first-frame images are detected even if their error event occurred before controller initialization.
- Subject output is WebP at 1152 px wide, quality 78 (no upscaling). SVG image coordinates remain 1152×2048; subject viewBox is 730×1490. This retains about 1490 subject pixels, versus the 1448 pixel target calculated above. Compression quality still needs visual acceptance.
- Current output photo: 260,514 bytes; largest printer variant: 45,778 bytes; combined first-frame layers: 306,292 bytes. Workshop: 106,300 bytes. These are build-file sizes, not measured browser transfers. Workshop remains data-src only until enhancement loading.
- `npm run build` passed; `node --test scripts/home-featured.test.mjs` passed (2 tests).
- Integration builds temporarily changed the configured ID to a missing model, then marked robot-cat draft. Both builds passed with the expected warning, no dedicated scene and no final story link; draft output did not link the hidden cat. Source files were restored afterward.
- `BASE=/print-showcase/ npm run build` passed. Generated hero/catalog links use the prefix, and generated src/href/data-src asset references resolve to files in dist.
- `git diff --check` and controller syntax check passed.
- Browser runtime initialized successfully but selection reported “No browser is available”; discovery returned an empty list after following the Browser skill troubleshooting instructions. No rendered-frame, browser-network, keyboard, resize or cross-browser acceptance is claimed. No screenshots or scroll recording have been fabricated.

The goal remains incomplete: finish the source-faithful mask/contact shadow and printer detail, render and inspect H01–H04 and both joins, record forward/reverse scroll, and execute the spec's browser acceptance matrix. Nothing was pushed or published.


## Composition and controller pass — 22 October 2026

- Refined the mask as a shared code-native path (`src/scripts/home-cat-mask.ts`), preserving the source photograph. Removed the table strip beside the left leg, tightened the foot/table boundary, and merged the arm opening into the outer contour to remove overlapping even-odd regions and a background wedge. No source photo pixels were generated or upscaled.
- Added separate soft contact shadows for the feet at their photographed depths. Raster studies were inspected against the source photograph; browser edge/shadow acceptance remains pending.
- Added `door-frame-detail.svg`, a traced vector layer on the door rails/sill. It fades in at 25–38% and follows the printer camera. Interior printer imagery remains raster; close-up sharpness still needs browser assessment.
- Corrected camera geometry after the H02 study exposed a floating cat: height is now 27% times printer scale, x stays at the zoom origin, and foot position stays on the scaled bed until the door crossing. Subject placement aligns with the table during the environment change.
- Restored contained/right-aligned static desktop framing, and moved the narrow crop up to expose the cat's face above the copy. Moved the early head check after viewport meta.
- Focused caption/intro states exclude each other. Disabling motion while the final model link has focus transfers focus to that model's ordinary catalog card and makes it visible.
- Deferred resource failures now preserve the healthy static cat/printer. Emergency original imagery is selected only for a failed first-frame resource; this supersedes the earlier unconditional emergency visual on deferred-layer failure.
- Added `npm test` and `npm run review:home`. Eleven tests pass, including meaningful camera, fallback, restoration and focus invariants, plus pageshow viewport revalidation; controller coverage is a DOM harness, not browser acceptance.
- Prepared 16 full-size HTML layouts, 16 PNG composition studies, static layouts and contact sheets under `review/`. HTML is frozen from built production markup/CSS; PNG rendering approximates text wrapping/tint/reflection. Neither is labelled as a native browser capture.
- Rechecked the prefixed build and generated asset/link references, single H1/catalog, static HTML default and deferred media attributes. Detailed outstanding matrix: `acceptance.md`.
- Confirmed the existing dev daemon is live at http://127.0.0.1:4322/ (not restarted). Browser discovery still returns no available browsers; a browser connection was requested. Native screenshots, network traces, cross-browser tests and scroll recording remain required. No push or publication.


## User browser feedback

User checked the page in a browser and reported it generally looks good. Moved final caption reveal from 74–84% to 60–72%, so it begins before the printer has fully faded at 70%. At 60%, printer opacity is about 35%; the text fades in smoothly while that remainder disappears. Individual browser-matrix cases are not inferred from this general feedback.
