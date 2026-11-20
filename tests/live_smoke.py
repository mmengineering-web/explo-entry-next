# READ-ONLY smoke test for the real deployment. It logs in, opens every tab the account may see, looks for errors and
# takes a screenshot of each tab. It never saves, edits, imports, syncs on purpose or deletes anything.
#
# Run it on your own computer (credentials never go into the repository or into chat):
#   pip install playwright && playwright install chromium
#   Windows (PowerShell):  $env:BASE="https://your-domain"; $env:EXP_SITE="WKM"; $env:EXP_EMAIL="you@company"; $env:EXP_PASSWORD="..."; python tests/live_smoke.py
#   macOS / Linux:         BASE=https://your-domain EXP_SITE=WKM EXP_EMAIL=you@company EXP_PASSWORD=... python3 tests/live_smoke.py
# Use a geologist or viewer account first; use a site admin account to also see Pengaturan.
import os, sys
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', '').rstrip('/'); SITE = os.environ.get('EXP_SITE', 'WKM')
EMAIL = os.environ.get('EXP_EMAIL', ''); PW = os.environ.get('EXP_PASSWORD', ''); OUT = os.environ.get('SHOTS', 'live-smoke')
if not (BASE and EMAIL and PW): sys.exit('Set BASE, EXP_EMAIL and EXP_PASSWORD (and EXP_SITE) first.')
os.makedirs(OUT, exist_ok=True); fails = []; warns = []
def check(n, c, extra=''):
    print(('PASS ' if c else 'FAIL ') + n + (' ' + str(extra) if extra and not c else ''))
    if not c: fails.append(n)
# tab key -> a selector that proves the tab drew its content
TABS = [('progress', '#f'), ('collars', '#f'), ('hours', '#f'), ('samples', '#f'), ('dash', '#dash'), ('qc', '#qc'), ('map', '#map.leaflet-container'),
        ('d3', '#d3-view'), ('import', '#imp-grid'), ('report', 'textarea, pre, #rep'), ('list', '#prec, #list, details'), ('admin', 'table, [data-grid], form')]
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1360, 'height': 900}, service_workers='allow'); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(BASE + '/'); pg.wait_for_selector('#lf', timeout=30000)
    check('login screen loads', True); pg.screenshot(path=f'{OUT}/00_login.png')
    sw = pg.evaluate("navigator.serviceWorker.getRegistrations().then(r => r.length)"); check('service worker registered', sw >= 1, sw)
    try: pg.select_option('#l-site', SITE)
    except Exception: warns.append(f'site {SITE} not in the site list')
    pg.fill('#l-email', EMAIL); pg.fill('#l-pw', PW); pg.click('#l-go')
    try: pg.wait_for_selector('aside button[data-t], nav button', timeout=30000); ok = True
    except Exception: ok = False
    check('login works', ok, pg.inner_text('#l-msg') if pg.locator('#l-msg').count() else '')
    if ok:
        pg.wait_for_timeout(3000)
        check('sync chip shows online', pg.locator('text=online').count() >= 1)
        for key, sel in TABS:
            btn = pg.locator(f'aside button[data-t={key}]')
            if not btn.count(): print(f'SKIP {key} (not visible for this account)'); continue
            btn.click()
            try: pg.wait_for_selector(sel, timeout=30000); pg.wait_for_timeout(2000); good = True
            except Exception: good = False
            pg.screenshot(path=f'{OUT}/tab_{key}.png', full_page=True); check(f'tab {key} draws', good)
            if key == 'dash': check('dashboard charts drawn', pg.locator('#dash canvas').count() >= 4, pg.locator('#dash canvas').count())
            if key == 'd3': print('INFO 3D note:', pg.inner_text('#d3-note')[:120])
            check(f'tab {key} no horizontal scroll', pg.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth"))
    real = [e for e in errs if 'Failed to load resource' not in e and 'GL Driver' not in e and 'GPU stall' not in e]
    check('no console or page errors', not real, real[:3])
    b.close()
for w in warns: print('WARN', w)
print('FAILS:', fails); sys.exit(1 if fails else 0)
