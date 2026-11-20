# Browser checks for the Next.js build with a fake Supabase.
#   npm run build:test && (cd out-test && python3 -m http.server 8801 &) && python3 tests/e2e.py
# Env: CHROME=/path/to/chrome (optional), BASE=http://localhost:8801, SHOTS=/tmp/shots-next
import os, sys
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8801'); SHOTS = os.environ.get('SHOTS', '/tmp/shots-next'); os.makedirs(SHOTS, exist_ok=True)
CHROME = os.environ.get('CHROME')
fails = []
def check(n, c, extra=''):
    print(('PASS ' if c else 'FAIL ') + n + (' ' + str(extra) if extra and not c else ''))
    if not c: fails.append(n)
def mk(p, w=1360, h=900, scheme='light', reduced='no-preference'):
    b = p.chromium.launch(**({'executable_path': CHROME, 'args': ['--no-sandbox']} if CHROME else {}))
    ctx = b.new_context(viewport={'width': w, 'height': h}, service_workers='block', color_scheme=scheme, reduced_motion=reduced)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    return b, pg, errs
def login(pg):
    pg.goto(BASE + '/'); pg.wait_for_selector('#lf'); pg.fill('#l-email', 'geo@x'); pg.fill('#l-pw', 'good'); pg.click('#l-go'); pg.wait_for_selector('#f')
noh = "document.documentElement.scrollWidth<=document.documentElement.clientWidth"

with sync_playwright() as p:
    for name, w, h, sch in [('login_d_light', 1360, 900, 'light'), ('login_d_dark', 1360, 900, 'dark'), ('login_m_light', 390, 844, 'light'), ('login_m_dark', 390, 844, 'dark')]:
        b, pg, errs = mk(p, w, h, sch); pg.goto(BASE + '/'); pg.wait_for_selector('#lf'); pg.wait_for_timeout(2600)
        pg.screenshot(path=f'{SHOTS}/{name}.png')
        check(name + ' no horizontal overflow', pg.evaluate(noh)); check(name + ' no errors', not errs, errs); b.close()

    # wrong password shows an error and stays on login
    b, pg, errs = mk(p); pg.goto(BASE + '/'); pg.wait_for_selector('#lf'); pg.fill('#l-email', 'geo@x'); pg.fill('#l-pw', 'bad'); pg.click('#l-go'); pg.wait_for_selector('#l-msg')
    check('wrong password message', 'Invalid' in pg.inner_text('#l-msg')); b.close()

    # logged in, desktop
    b, pg, errs = mk(p); login(pg); pg.wait_for_timeout(2500)
    tabs = pg.eval_on_selector_all('aside button[data-t]', 'bs => bs.map(b => b.dataset.t)')
    check('shell lists input tabs', all(t in tabs for t in ['progress', 'collars', 'hours', 'samples']), tabs)
    check('sync chip shows online', 'online' in pg.inner_text('#sync-chip'), pg.inner_text('#sync-chip'))
    pg.screenshot(path=f'{SHOTS}/progress_d_empty.png')
    state = lambda: pg.evaluate("document.querySelector('#corebox').dataset.open")
    check('core box open for empty hole', state() == 'true', state())
    pg.fill('[name=hole_id]', 'WKM-DD-0003'); pg.wait_for_timeout(500)
    check('known coring (DD) hole keeps core box open', state() == 'true', state())
    check('From auto-filled from last depth', pg.input_value('[name=from_m]') == '45', pg.input_value('[name=from_m]'))
    check('From hint visible', pg.is_visible('#from-hint'))
    check('depth bar visible', pg.is_visible('#depth'))
    pg.fill('[name=to_m]', '50'); pg.wait_for_timeout(400)
    txt = pg.inner_text('#depth'); check('depth text', 'Terbor' in txt and ('Sisa' in txt or 'Lewat rencana' in txt), txt)
    check('meters computed', pg.input_value('[name=meters]') == '5.00', pg.input_value('[name=meters]'))
    check('reason optional at 0 h', pg.evaluate("!document.querySelector('[name=downtime_reason]').required"))
    pg.fill('[name=downtime_hours]', '2')
    check('reason required when hours > 0', pg.evaluate("document.querySelector('[name=downtime_reason]').required && document.querySelector('[name=downtime_reason]').getAttribute('aria-required')==='true'"))
    pg.fill('[name=downtime_hours]', '0')
    pg.fill('[name=from_m]', '44'); pg.fill('[name=hole_id]', 'WKM-DD-0001'); pg.wait_for_timeout(300)
    check('typed From is kept when hole changes', pg.input_value('[name=from_m]') == '44', pg.input_value('[name=from_m]'))
    pg.fill('[name=hole_id]', 'NEW-HOLE-1'); pg.wait_for_timeout(500)
    check('unknown hole shows core box', state() == 'true', state())
    pg.screenshot(path=f'{SHOTS}/progress_d_filled.png', full_page=True)

    # validation error, then a real save to the device outbox
    pg.fill('[name=hole_id]', 'WKM-DD-0003'); pg.fill('[name=from_m]', '45'); pg.fill('[name=to_m]', '40')
    if pg.input_value('[name=rig_id]') == '': pg.select_option('[name=rig_id]', index=1)
    pg.click('#b-save'); pg.wait_for_selector('#msgs div'); check('From > To is refused', 'msgs' and pg.locator('#msgs div').count() > 0)
    pg.fill('[name=to_m]', '46'); pg.click('#b-save'); pg.wait_for_timeout(800)
    n = pg.evaluate("""async()=>{const r=await new Promise(res=>{const q=indexedDB.open('exploration_WKM');q.onsuccess=()=>res(q.result)});
      const c=(s)=>new Promise(res=>{const t=r.transaction(s).objectStore(s).count();t.onsuccess=()=>res(t.result)});return [await c('progress'),await c('outbox')]}""")
    check('record saved on the device', n[0] >= 1, n)   # a successful fake sync empties the outbox, so the outbox is checked in guest mode below
    check('saved record appears in the list', pg.locator('#prec li').count() >= 1)

    # command palette, theme
    pg.keyboard.press('Control+k'); pg.wait_for_selector('[cmdk-input]'); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{SHOTS}/palette_d.png')
    n0 = pg.locator('[cmdk-item]').count(); pg.fill('[cmdk-input]', 'sam'); pg.wait_for_timeout(150)
    check('palette filters', 0 < pg.locator('[cmdk-item]:visible').count() < n0, (n0, pg.locator('[cmdk-item]:visible').count()))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    check('palette navigates to Sampel', pg.get_attribute('#view', 'data-tab') == 'samples', pg.get_attribute('#view', 'data-tab'))
    check('palette closed', pg.locator('[cmdk-input]').count() == 0)
    pg.keyboard.press('Control+k'); pg.wait_for_selector('[cmdk-input]'); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    check('Esc closes palette', pg.locator('[cmdk-input]').count() == 0)
    pg.click('header button[aria-label="Ganti tema"]'); pg.wait_for_timeout(200)
    check('theme toggles', pg.evaluate("document.documentElement.dataset.theme") == 'dark')
    check('desktop no overflow', pg.evaluate(noh)); check('no JS errors (desktop)', not errs, errs); b.close()

    # a known NON-coring hole (auger) hides the core box and makes it inert; a collar is injected into the device DB, then the form is remounted
    b, pg, errs = mk(p); login(pg)
    pg.evaluate("""async()=>{const r=await new Promise(res=>{const q=indexedDB.open('exploration_WKM');q.onsuccess=()=>res(q.result)});
      await new Promise(res=>{const t=r.transaction('collars','readwrite');t.objectStore('collars').put({id:'ag-1',hole_id:'WKM-AG-0001',hole_type:'AG',status:'drilling',is_deleted:false});t.oncomplete=res})}""")
    pg.click('aside button[data-t=hours]'); pg.wait_for_selector('#hlists'); pg.click('aside button[data-t=progress]'); pg.wait_for_selector('#corebox'); pg.wait_for_timeout(500)
    pg.fill('[name=hole_id]', 'WKM-AG-0001'); pg.wait_for_timeout(500)
    check('known non-coring hole hides core box', pg.evaluate("document.querySelector('#corebox').dataset.open") == 'false')
    check('hidden core box is inert', pg.evaluate("document.querySelector('#corebox').hasAttribute('inert')"))
    check('no JS errors (non-coring)', not errs, errs); b.close()

    # phone
    b, pg, errs = mk(p, 390, 844); login(pg); pg.wait_for_timeout(2500)
    pg.screenshot(path=f'{SHOTS}/progress_m.png', full_page=True)
    check('phone no overflow', pg.evaluate(noh))
    check('tab bar has 5 buttons', pg.locator('nav[aria-label=Tab] button').count() == 5, pg.locator('nav[aria-label=Tab] button').count())
    pg.click('nav[aria-label=Tab] button[aria-label=Lainnya]'); pg.wait_for_selector('[cmdk-input]'); pg.screenshot(path=f'{SHOTS}/palette_m.png')
    check('no JS errors (phone)', not errs, errs); b.close()

    # guest mode (offline-first): enter without login, save, outbox keeps it
    b, pg, errs = mk(p); pg.goto(BASE + '/'); pg.wait_for_selector('#l-guest'); pg.click('#l-guest'); pg.wait_for_selector('#f'); pg.wait_for_timeout(500)
    tabs = pg.eval_on_selector_all('aside button[data-t]', 'bs => bs.map(b => b.dataset.t)')
    check('guest sees no dashboard tabs', 'dash' not in tabs and 'progress' in tabs, tabs)
    pg.fill('[name=rig_id]', 'RIG-01') if pg.locator('input[name=rig_id]').count() else pg.select_option('[name=rig_id]', index=1)
    pg.fill('[name=hole_id]', 'GUEST-HOLE-1'); pg.fill('[name=from_m]', '0'); pg.fill('[name=to_m]', '3'); pg.click('#b-save'); pg.wait_for_timeout(300)
    if pg.locator('#b-force').count(): pg.click('#b-force'); pg.wait_for_timeout(500)
    ob = pg.evaluate("""async()=>{const r=await new Promise(res=>{const q=indexedDB.open('exploration_WKM');q.onsuccess=()=>res(q.result)});
      return await new Promise(res=>{const t=r.transaction('outbox').objectStore('outbox').count();t.onsuccess=()=>res(t.result)})}""")
    check('guest save waits in the outbox', ob >= 1, ob)
    check('guest chip shows pending', 'pending' in pg.inner_text('#sync-chip') or 'menunggu' in pg.inner_text('#sync-chip'), pg.inner_text('#sync-chip'))
    check('no JS errors (guest)', not errs, errs); b.close()

print('\nALL PASSED' if not fails else '\nFAILS ' + str(fails)); sys.exit(1 if fails else 0)
