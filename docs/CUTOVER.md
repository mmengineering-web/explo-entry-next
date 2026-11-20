# Cutover runbook: vanilla v2.0.0 to the Next.js app

Goal: phones and laptops move to the new app with no lost data, and the old app stays ready for a quick rollback.

## 0. What carries over, and when

The new app keeps the same local database and login keys as v2.0.0: IndexedDB `exploration_<SITE>` (schema version 5, same file `db.js`), login key `sb-exp-<SITE>`, and the same `exp_*` browser settings. Browsers keep storage **per origin** (the full address). That decides everything:

| Case | Old app address | After the swap | Phone data |
|---|---|---|---|
| **A. Same address** | A custom domain (for example `explo.company.com`) that you point to Vercel | Same origin | Unsent records, sessions and settings stay. Users only reload. |
| **B. New address** | `*.github.io/...` or any address you cannot move | Different origin | Phones start empty. Unsent data in the old app is **stranded** unless it is synced first. |

Confirm the case first: open the old app, copy the address, compare with the address you will use for the new app.

## 1. Before the swap (all cases)

1. Vercel preview or production URL is up. `sw.js` line in the build log shows the expected file count.
2. Run the live smoke test with a geologist account, then with a site admin account (see top of `tests/live_smoke.py`). Expect `FAILS: []`.
3. Do the phone tests in `docs/PHONE_TESTS.md` on at least one Android phone and one iPhone. Use test Hole IDs that start with `TEST-` and remove them afterwards (soft delete, see SOFT_DELETE_AND_PURGE.md).
4. As a site admin, change one Lab Analysis parameter, reload, confirm it stuck, then reset it. This proves the `exp_setting` access rules.
5. Check the Supabase projects are awake (free plan projects pause when idle).
6. Case A only: lower the DNS TTL to 300 seconds one day ahead, so a rollback is quick.

## 2. Case B only: empty every phone first

Each person, on each phone, in the **old** app:
1. Log in (guest records are sent after a normal login).
2. Tap sync until the chip reads `online - 0 pending`.
3. Open Data Records and confirm the last records are there.
4. Only then open the new address.

Anything still pending when someone switches is not lost on the phone, but it stays in the old origin. They can open the old address again and finish the sync.

## 3. The swap

Case A:
1. Vercel project > Settings > Domains > add the domain. Follow the DNS records Vercel shows (do not guess them).
2. Change the record at your DNS provider. Wait for Vercel to show the domain as valid and issue the certificate.
3. Open the domain in a private window. Run `tests/live_smoke.py` against it.

Case B:
1. Share the new address and ask people to install it from the browser menu (Add to Home screen).
2. Keep the old app online for at least two weeks.

## 4. After the swap

- Phones show a toast "A new version is ready" when a later release arrives. Close and reopen the app.
- The first load removes the old `exp-pwa-*` cache automatically.
- Watch for three days: sync errors (badge `error` in the sync chip), login failures, and Supabase API errors.

## 5. Rollback

Case A: point the DNS record back to the old host. Phones fetch the old files once they are online. Local data is safe because the new app never changed the database schema.
Case B: tell people to use the old address again; nothing has to be moved.

**Rule until the old app is retired:** do not add a Dexie version (`db.version(6)` and up) in the new app. An older app cannot open a newer local database, so a rollback would then fail on phones that already upgraded.

## 6. Retire the old app

After two clean weeks: archive the old repository, remove its Pages deployment, delete this rollback section from your notes, and then new Dexie versions are allowed again.

## Known limits

- iOS has no background sync and Safari may clear site data after about 7 days without use. Tell iPhone users to sync before a long break.
- Dashboard, Data QC and 3D Hole need internet. Input and sync work offline.
- The "All sites" hub dashboard of v2.0.0 is not in the new app.
