# Explo Entry (Next.js) — Laterite Strata

Offline-first exploration data-entry PWA. Next.js 16 static export + React 19 + Tailwind v4 + shadcn-style components + Motion.
Runs side by side with the vanilla v2.0.0 app until phone testing passes.

## Status
| Phase | Scope | State |
|---|---|---|
| 1 | Scaffold, tokens, shell, login, guest mode, Dexie + outbox sync, command palette, Progress form with dynamic rules | Done |
| 2 | Collar, Distribution Hour, Sampel, Import, Data Records, Laporan, Pengaturan | Todo |
| 3 | Dashboard, Data QC, collar map, Excel/PDF export, RoA Lab, Lab Analysis | Todo |
| 4 | 3D drill-hole view (react-three-fiber, low-power fallback), login scene polish | Todo |
| 5 | Port browser tests, real-phone tests, docs, Vercel domain swap | Todo |

Tabs not yet ported show a "Soon" placeholder (`src/components/soon.tsx`).

## Commands
```bash
npm install
npm run dev          # local dev
npm run build        # production static export -> out/ + sw.js
npm run build:test   # test build -> out-test/ with a fake Supabase (NEVER deploy)
npm run test:unit    # rule evaluator tests
python3 tests/e2e.py # Playwright e2e; env CHROME, BASE (default http://localhost:8801), SHOTS
```
e2e flow: `npm run build:test`, serve `out-test/` on port 8801, run `tests/e2e.py`.

## Layout
- `src/lib/core/*.js`: offline core reused from v2.0.0 (db, sync, validate, rules, defs, cfg, utm, brand). Loaded lazily via `core()` in `src/lib/boot.ts`.
- `src/components/`: `app-shell`, `login`, `progress-form`, `toast`, `ui/*` (hand-written shadcn-style).
- `src/app/globals.css`: Laterite tokens, `@theme inline` mapping, motion keyframes.
- `scripts/make-sw.mjs` + `public/sw.template.js`: service worker generated after build with a content-hash cache name.
- `vercel.json`: no-cache for `sw.js` and the manifest, immutable cache for `/_next/static`.

## Porting a form (Phases 2-5 map)
1. Copy the matching `view*` function from vanilla `js/app.js`.
2. Write `src/components/<name>-form.tsx` following `progress-form.tsx`: `Dyn` for `showIf`, `evalCond` for rules, `D.saveRecord` + `S.syncSoon()` to save.
3. Replace the `Soon` branch for that tab in `app-shell.tsx`.
4. Add checks to `tests/e2e.py` (ids: `#f`, `#b-save`, `#msgs`).

## Known limits
- shadcn registry was unreachable, so components are hand-written with the same token names. `npx shadcn add` still works later.
- Tested only in headless Chrome with a fake Supabase. No real Supabase, live data or real phone yet.
- Never commit API keys. Supabase URL and anon key come from `src/lib/core/config.js` per site, as in v2.0.0.
