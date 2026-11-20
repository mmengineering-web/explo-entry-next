# Service worker takeover checks (cutover): old caches are removed, the app opens offline, a new version asks for a reload.
#   npm run build:test && (cd out-test && python3 -m http.server 8801 &) && python3 tests/e2e_sw.py
import os
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8801'); CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome'); fails = []
def check(n, c, extra=''):
    print(('PASS ' if c else 'FAIL ') + n + (' ' + str(extra) if extra and not c else ''))
    if not c: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1200, 'height': 800})
    # what a phone that ran the old vanilla app (cache exp-pwa-v48) and an earlier build of this app looks like
    ctx.add_init_script("caches.open('exp-pwa-v48').then(c=>c.put('/old.js', new Response('x'))); caches.open('exp-next-stale').then(c=>c.put('/old.js', new Response('x')))")
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/'); pg.wait_for_selector('#lf', timeout=15000)
    pg.evaluate("navigator.serviceWorker.ready.then(()=>1)"); pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=30000); pg.wait_for_timeout(1500)
    keys = pg.evaluate("caches.keys()")
    check('one current cache remains', len(keys) == 1 and keys[0].startswith('exp-next-') and keys[0] != 'exp-next-stale', keys)
    check('old vanilla cache removed', 'exp-pwa-v48' not in keys)
    ctx.set_offline(True); pg.reload(); pg.wait_for_selector('#lf', timeout=15000)
    check('app shell opens offline', pg.locator('#lf').count() == 1)
    ctx.set_offline(False)
    pg.evaluate("navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))"); pg.wait_for_timeout(500)
    check('a new version asks for a reload', pg.locator('text=A new version is ready').count() == 1)
    check('no page errors', not errs, errs[:2])
    b.close()
print('FAILS:', fails)
