# Browser checks for Phase 2 forms (Collar, Distribution Hour, Sampel) on the test build with a fake Supabase.
#   npm run build:test && (cd out-test && python3 -m http.server 8801 &) && python3 tests/e2e_forms.py
import os, sys
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8801'); SHOTS = os.environ.get('SHOTS', '/tmp/shots-next'); os.makedirs(SHOTS, exist_ok=True)
CHROME = os.environ.get('CHROME'); fails = []
def check(n, c, extra=''):
    print(('PASS ' if c else 'FAIL ') + n + (' ' + str(extra) if extra and not c else ''))
    if not c: fails.append(n)
def mk(p, w=1360, h=900):
    b = p.chromium.launch(**({'executable_path': CHROME, 'args': ['--no-sandbox']} if CHROME else {}))
    ctx = b.new_context(viewport={'width': w, 'height': h}, service_workers='block'); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    return b, pg, errs
def login(pg):
    pg.goto(BASE + '/'); pg.wait_for_selector('#lf'); pg.fill('#l-email', 'geo@x'); pg.fill('#l-pw', 'good'); pg.click('#l-go'); pg.wait_for_selector('#f'); pg.wait_for_timeout(1500)
def tab(pg, t):
    pg.click(f'aside button[data-t={t}]'); pg.wait_for_selector('#f'); pg.wait_for_timeout(600)
def count(pg, store, where=''):
    return pg.evaluate("""async(s)=>{const r=await new Promise(res=>{const q=indexedDB.open('exploration_WKM');q.onsuccess=()=>res(q.result)});
      return await new Promise(res=>{const t=r.transaction(s).objectStore(s).getAll();t.onsuccess=()=>res(t.result.filter(x=>!x.is_deleted).length)})}""", store)
def rows(pg, id): return pg.locator(f'[id="rl-{id}"] tbody tr[data-row]').count()
noh = "document.documentElement.scrollWidth<=document.documentElement.clientWidth"

with sync_playwright() as p:
    b, pg, errs = mk(p); login(pg)

    # ---- Collar
    tab(pg, 'collars')
    check('collar title', 'Input collar' in pg.inner_text('#f'))
    check('collar list shows 4 seeded rows', rows(pg, 'f:collars') == 4, rows(pg, 'f:collars'))
    pg.fill('[id="rl-f:collars"] .rl-q', '0003'); pg.wait_for_timeout(400)
    check('collar search filters', rows(pg, 'f:collars') == 1, rows(pg, 'f:collars'))
    pg.click('[id="rl-f:collars"] .rl-reset'); pg.wait_for_timeout(300)
    check('reset restores rows', rows(pg, 'f:collars') == 4)
    pg.select_option('#pick', label='WKM-DD-0004'); pg.wait_for_timeout(300)
    check('picking a planned hole opens edit', 'Edit collar' in pg.inner_text('#f') and pg.input_value('[name=hole_id]') == 'WKM-DD-0004', pg.inner_text('#f')[:40])
    pg.click('#b-cancel'); pg.wait_for_timeout(400)
    check('cancel returns to new', 'Input collar' in pg.inner_text('#f') and pg.input_value('[name=hole_id]') == '')
    pg.select_option('[name=hole_type]', 'DD'); pg.click('#b-genid'); pg.wait_for_timeout(300)
    hid = pg.input_value('[name=hole_id]')
    check('generated hole id', hid.startswith('WKM-DD-') and hid.endswith('001'), hid)
    pg.select_option('[name=prospect]', 'N1'); pg.fill('[name=planned_depth_m]', '30'); pg.fill('[name=planned_lat]', '-3.2'); pg.fill('[name=planned_lon]', '121.2')
    check('prospect shows name not code', 'North One' in pg.inner_text('[name=prospect]'))
    pg.fill('[name=dip_deg]', '-120'); pg.click('#b-save'); pg.wait_for_timeout(400)
    check('bad dip is blocked by the field', pg.evaluate("!document.querySelector('[name=dip_deg]').validity.valid") and count(pg, 'collars') == 4)
    pg.fill('[name=dip_deg]', '-60'); pg.click('#b-save'); pg.wait_for_timeout(500)
    if pg.locator('#b-force').count(): pg.click('#b-force'); pg.wait_for_timeout(500)
    check('collar saved to device', count(pg, 'collars') == 5, (count(pg, 'collars'), pg.inner_text('#msgs')))
    check('collar list now 5 rows', rows(pg, 'f:collars') == 5, rows(pg, 'f:collars'))
    pg.screenshot(path=f'{SHOTS}/collar_d.png', full_page=True)
    # edit + soft delete
    pg.click(f'[id="rl-f:collars"] tbody tr:has-text("{hid}")'); pg.wait_for_timeout(400)
    check('row click opens edit', 'Edit collar' in pg.inner_text('#f') and pg.input_value('[name=hole_id]') == hid)
    pg.click('#b-del'); pg.wait_for_selector('#confirm-ok'); pg.click('#confirm-ok'); pg.wait_for_timeout(500)
    check('collar soft-deleted', count(pg, 'collars') == 4, count(pg, 'collars'))

    # ---- Distribution hour
    tab(pg, 'hours')
    check('hours title', 'Input distribution hour' in pg.inner_text('#f'))
    check('hours list has seeded rows', rows(pg, 'f:disthours') >= 20, rows(pg, 'f:disthours'))
    h0 = count(pg, 'disthours')
    pg.fill('[name=work_date]', '2025-10-06'); pg.select_option('[name=rig_id]', 'R1'); pg.wait_for_timeout(400)
    check('From prefilled with previous end', pg.input_value('[name=from_time]') == '19:00', pg.input_value('[name=from_time]'))
    check('accumulation table shows R1', 'R1' in pg.inner_text('#hlists') and '10' in pg.inner_text('#hlists'), pg.inner_text('#hlists')[:120])
    pg.fill('[name=dur]', '90'); pg.wait_for_timeout(300)
    check('duration fills To', pg.input_value('[name=to_time]') == '20:30' and pg.input_value('[name=hrs]') == '1.5', (pg.input_value('[name=to_time]'), pg.input_value('[name=hrs]')))
    pg.fill('[name=from_time]', '18:00'); pg.wait_for_timeout(200)
    pg.click('#b-save'); pg.wait_for_timeout(400)
    check('overlap refused', 'Bentrok' in pg.inner_text('#msgs'), pg.inner_text('#msgs'))
    pg.fill('[name=from_time]', '19:00'); pg.click('#b-save'); pg.wait_for_timeout(500)
    n = count(pg, 'disthours'); check('hour saved', n == h0 + 1, (n, h0))
    check('date and rig kept after save', pg.input_value('[name=work_date]') == '2025-10-06' and pg.input_value('[name=rig_id]') == 'R1')
    check('next From continues', pg.input_value('[name=from_time]') == '20:30', pg.input_value('[name=from_time]'))
    pg.screenshot(path=f'{SHOTS}/hours_d.png', full_page=True)

    # ---- Samples
    tab(pg, 'samples')
    check('sample title', 'Register sampel' in pg.inner_text('#f'))
    check('sample list shows S1,S2', rows(pg, 'f:samples') == 2, rows(pg, 'f:samples'))
    pg.fill('[name=hole_id]', 'WKM-DD-0001'); pg.press('[name=hole_id]', 'Tab'); pg.wait_for_timeout(300)
    check('sample From continues from last', pg.input_value('[name=from_m]') == '2', pg.input_value('[name=from_m]'))
    check('sample info line', 'sampel terdaftar 2' in pg.inner_text('#sinfo'), pg.inner_text('#sinfo'))
    pg.fill('[name=sample_no]', 'S3'); pg.fill('[name=to_m]', '1'); pg.click('#b-save'); pg.wait_for_timeout(300)
    check('to <= from refused', pg.locator('#msgs div').count() >= 1)
    pg.fill('[name=sample_no]', 'S1'); pg.fill('[name=to_m]', '3'); pg.click('#b-save'); pg.wait_for_timeout(300)
    check('duplicate number refused', 'sudah ada' in pg.inner_text('#msgs'), pg.inner_text('#msgs'))
    # split 2..8 per 2 m => 3 samples
    pg.fill('[name=sample_no]', 'S10'); pg.fill('[name=to_m]', '8'); pg.fill('[name=step]', '2'); pg.click('#b-split'); pg.wait_for_selector('#confirm-ok'); pg.click('#confirm-ok'); pg.wait_for_timeout(600)
    n = count(pg, 'samples'); check('split created 3 samples', n == 5, n)
    check('list shows 5', rows(pg, 'f:samples') == 5, rows(pg, 'f:samples'))
    # bulk status
    pg.locator('[id="rl-f:samples"] tbody tr:has-text("S10") input[type=checkbox]').check(); pg.locator('[id="rl-f:samples"] tbody tr:has-text("S11") input[type=checkbox]').check()
    check('selection counter', pg.inner_text('#s-n') == '2', pg.inner_text('#s-n'))
    pg.fill('#b-lab', 'LabX'); pg.click('[data-set=SENT]'); pg.wait_for_timeout(600)
    check('bulk SENT applied', pg.locator('[id="rl-f:samples"] tbody tr:has-text("S10")').inner_text().count('SENT') >= 1 or 'LabX' in pg.locator('[id="rl-f:samples"] tbody tr:has-text("S10")').inner_text(), pg.locator('[id="rl-f:samples"] tbody tr:has-text("S10")').inner_text())
    pg.screenshot(path=f'{SHOTS}/samples_d.png', full_page=True)
    check('desktop no overflow', pg.evaluate(noh)); check('no JS errors (desktop)', not errs, errs); b.close()

    # phone: forms and lists must not overflow the page (tables scroll inside their box)
    b, pg, errs = mk(p, 390, 844); login(pg)
    for t in ['collars', 'hours', 'samples']:
        tab(pg, t) if pg.locator(f'aside button[data-t={t}]').is_visible() else None
    for t, lab in [('collars', 'Collar'), ('hours', 'Distribution'), ('samples', 'Sampel')]:
        pg.click(f'nav[aria-label=Tab] button:has-text("{lab}")'); pg.wait_for_selector('#f'); pg.wait_for_timeout(600)
        check(f'phone {t} no overflow', pg.evaluate(noh)); pg.screenshot(path=f'{SHOTS}/{t}_m.png', full_page=True)
    check('no JS errors (phone)', not errs, errs); b.close()

print('\nALL PASSED' if not fails else '\nFAILS ' + str(fails)); sys.exit(1 if fails else 0)
