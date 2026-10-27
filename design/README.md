# Design

Look: Milanote-like. Light warm-grey canvas, white cards with soft shadow, 8 px grid, Inter/system font, ~10 card colours.

`tokens.css` holds the tokens (CSS variables), imported by `web/src/index.css`. Use them; no new colours/sizes without reason. Current values are **placeholders** until Claude Design mockups land.

Mockups are made in Claude Design from the brief:
https://claude.ai/artifact/QFmT5WHFuaKDXEok9n3P98 (Milanote Clone — Mockup Brief)

When mockups are ready, put here:
- `tokens.css` — real colours, type scale, radii, shadows, spacing from the Foundations section.
- `screens/` — one exported frame per screen/state (`<nn>-<screen>-<state>.png`).
- This README — screen map + design decisions. It wins over the brief when they differ.
