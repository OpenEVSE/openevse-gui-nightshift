# AGENTS.md — working on gui-nightshift

Guidance for AI coding agents. This is the **default web UI for the OpenEVSE
ESP32 firmware** — a Svelte 5 + Vite + Tailwind app, usually checked out as the
`gui-nightshift` git submodule of
[openevse_esp32_firmware](https://github.com/OpenEVSE/openevse_esp32_firmware).

## Commands

```bash
npm install
npm run dev:mock      # offline dev against built-in mock data — start here
npm run dev           # against a real charger (VITE_OPENEVSEHOST in .env)
npm test              # vitest unit tests — must pass before committing
npm run build         # production build → dist/ (embedded into the firmware)
npm run screenshots   # regenerate docs/screenshots/*.png (deterministic)
```

## Architecture rules

- **Route components are the only store-aware units.** Pure logic lives in
  `src/lib/**` modules and gets unit tests; components stay thin.
- **Device writes are serialised through a single queue** — the device's web
  server is single-threaded. Never issue parallel writes.
- The route table is exact-match (`src/lib/routes.js`); settings pages are
  catalogued in `src/lib/config/pages.js` (single source of truth for hub,
  nav, and placeholder routes).
- i18n: all user-visible strings go through `svelte-i18n`; add new keys to
  **all** catalogs in `src/lib/i18n/` (en, es, fr, hu — English text is an
  acceptable placeholder in the others).
- Mock mode (`dev/mock-plugin.js` + `dev/fixtures/`) must keep covering every
  endpoint the app calls — extend the fixtures when adding an API call.

## After any UI-visible change

1. `npm test` and `npm run build` must pass.
2. `npm run screenshots` — regenerate and commit any changed images in
   `docs/screenshots/` (the manifest is `scripts/screenshots.config.js`; add an
   entry when adding a screen).

## Submodule workflow (when checked out inside the firmware repo)

Commit and **push this repo first**; only then bump the firmware's submodule
pointer, together with the firmware's regenerated `src/web_static/` headers
(`pio run` regenerates them from `dist/`). Never point the firmware at an
unpushed commit here.
