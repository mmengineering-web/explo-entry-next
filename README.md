# Explo Entry (Next.js) — Laterite Strata

Offline-first exploration data-entry PWA. Next.js 16 static export + React 19 + Tailwind v4 + shadcn-style components + Motion.
Runs side by side with the vanilla v2.0.0 app until phone testing passes.

## Status
| Phase | Scope | State |
|---|---|---|
| 1 | Scaffold, tokens, shell, login, guest mode, Dexie + outbox sync, command palette, Progress form with dynamic rules | Done |
| 2a | Collar, Distribution Hour, Sampel forms, shared form kit, searchable record list, confirm dialog | Done |
| 2b | Data Records (lists, Excel and photo backup), Laporan, Import (template, preview, register missing), Pengaturan (rig, prospect, code lists with drag order, parameters, users, roles) | Done |
| 3 | Dashboard, Data QC, collar map, Excel/PDF export, RoA Lab, Lab Analysis | Todo |
| 4 | 3D drill-hole view (react-three-fiber, low-power fallback), login scene polish | Todo |
| 5 | Port browser tests, real-phone tests, docs, Vercel domain swap | Todo |

Tabs not yet ported (Data Records, Laporan, Import, Pengaturan, Dashboard, Data QC, Peta) show a "Soon" placeholder (`src/components/soon.tsx`).

## Commands
```bash
npm install
npm run dev          # local dev
npm run build        # production static export -> out/ + sw.js
npm run build:test   # test build -> out-test/ with a fake Supabase (NEVER deploy)
npm run test:unit    # rule evaluator tests
python3 tests/e2e.py        # shell, login, Progress form
python3 tests/e2e_data.py   # Laporan, Data Records, Import, Pengaturan (site admin role via window.__role)
python3 tests/e2e_forms.py  # Collar, Distribution Hour, Sampel (env CHROME, BASE default http://localhost:8801, SHOTS)
```
e2e flow: `npm run build:test`, serve `out-test/` on port 8801, run `tests/e2e.py`.

## Layout
- `src/lib/core/*.js`: offline core reused from v2.0.0 (db, sync, validate, rules, defs, cfg, utm, brand). Loaded lazily via `core()` in `src/lib/boot.ts`.
- `src/components/`: `app-shell`, `login`, `progress-form`, `collar-form`, `hours-form`, `sample-form`, `form-kit` (Field, Dyn, Msgs, photo), `record-list` (search, column filters, sort, selection), `confirm`, `toast`, `ui/*` (hand-written shadcn-style).
- `src/lib/rec-cols.tsx`: one column set per table, shared by form pages and Data Records. `src/lib/editing.ts`: hands a record from a list to the form that edits it.
- `src/app/globals.css`: Laterite tokens, `@theme inline` mapping, motion keyframes.
- `scripts/make-sw.mjs` + `public/sw.template.js`: service worker generated after build with a content-hash cache name.
- `vercel.json`: no-cache for `sw.js` and the manifest, immutable cache for `/_next/static`.

## Porting a form (Phases 2-5 map)
1. Copy the matching `view*` function from vanilla `js/app.js`.
2. Write `src/components/<name>-form.tsx` following `progress-form.tsx`: `Dyn` for `showIf`, `evalCond` for rules, `D.saveRecord` + `S.syncSoon()` to save.
3. Replace the `Soon` branch for that tab in `app-shell.tsx`.
4. Add checks to `tests/e2e.py` (ids: `#f`, `#b-save`, `#msgs`).

## Behavior notes
- A code list the site database does not define at all (e.g. no `hole_type` rows) falls back to the built-in codes. A deactivated list still has rows and stays empty.
- The test stub marks the `planned` collar status with `is_plan: true`, like production, so the Collar "pick from plan" list works.

## Known limits
- shadcn registry was unreachable, so components are hand-written with the same token names. `npx shadcn add` still works later.
- Tested only in headless Chrome with a fake Supabase. No real Supabase, live data or real phone yet.
- Never commit API keys. Supabase URL and anon key come from `src/lib/core/config.js` per site, as in v2.0.0.
