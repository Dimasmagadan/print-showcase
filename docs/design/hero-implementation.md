# Hero implementation verification

Branch: `feat/hero-generation`.

Implemented the supplied generated P2S illustration through Astro assets, preserving
its PNG source and identifying it as an illustration in the alt text. The linked
redesign spec supplies the dark palette, Inter, header, hero text/actions, four-column
4:3 catalog, tablet grid, and native mobile horizontal catalog. Design values are
recorded in `design-tokens.md`. Existing model content, filtering, gallery, video,
Telegram links, conditional contact, routes, and OG generation are preserved.

Changed implementation files:
- `src/pages/index.astro`
- `src/layouts/Base.astro`
- `src/styles/global.css`
- `design-tokens.md`

Verified locally:
- `npm run build` succeeds, including all four model pages and OG images.
- All generated internal href/src resources under `/print-showcase/` resolve.
- Every generated HTML page has exactly one H1 and no empty anchor href.
- Catalog has four model links; hero loads eagerly with high priority; covers load lazily.
- `git diff --check` passes.
- Computed WCAG contrast for solid color pairs: body 17.80:1, muted 9.09:1,
  primary button 11.02:1, secondary button 13.46:1, metadata on surface 8.23:1.
  Image-backed hero contrast still needs rendered verification.
- Source inspection confirms draft filtering, empty collection fallback, optional
  contact/channel rendering, contain-fit preservation, and reduced-motion styles.

Pending browser verification: no browser is connected (browser discovery returned
an empty list). Screenshots at 390×844, 768×1024, 1440×900 and model pages at
390×844 / 1440×900 were therefore not captured. Also pending: actual overflow at
360/1024/1920, 200% text zoom, keyboard focus/mobile catalog scrolling, final hero
contrast and image blending, lightbox, and the third-party Telegram widget.
The CSS contains explicit measures for these cases; source inspection does not
prove their rendered behavior. Keep final visual acceptance pending these checks.

The supplied illustration contains generated product markings; it is a portfolio
illustration rather than a technical product image. Existing light render backdrops
are retained as specified. New labels need user proofreading before publication.
No commit or push was performed; unrelated `.claude/` and Python cache are untouched.
