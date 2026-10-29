# Short K2→K7 prototype

Local review URL: http://127.0.0.1:8767/docs/design/robot-cat-redesign/prototype/index.html

This intermediate study was reviewed before the complete production sequence was rendered. It is retained for the composition/transition history; final production results are in [../acceptance.md](../acceptance.md).

Serve the repository root on port 8767. The prototype uses 31 raster frames (six samples per transition), the shared deterministic state function and the memory-bounded pool. A single body persists throughout; reverse scroll uses the same mapping. Static source poses and head paths were corrected during review, including clearance before rotation, leg seating before close-up, and incoming-ear framing.

Regenerate private prototype renders with `scripts/robot-cat-redesign-render.py --prototype`, then package with `scripts/robot-cat-redesign-assets.py`. The `state.js`/`pool.js` copies are compiled from the production TypeScript modules with Node's `stripTypeScriptTypes`. The complete page uses 85 frames at twelve samples per transition and provides its own full HTML/portrait fallback. This prototype is an internal study, not a public route.
