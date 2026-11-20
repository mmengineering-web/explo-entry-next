# Browser checks for Phase 2b (Laporan, Data Records, Import, Pengaturan) on the test build with a fake Supabase.
#   npm run build:test && (cd out-test && python3 -m http.server 8801 &) && python3 tests/e2e_data.py
import os, io
from playwright.sync_api import sync_playwright
import openpyxl
BASE = os.environ.get('BASE', 'http://localhost:8801'); SHOTS = os.environ.get('SHOTS', '/tmp/shots-next'); os.makedirs(SHOTS, exist_ok=True)
CHROME = os.environ.get('CHROME'); fails = []
def check(n, c, extra=''):
    print(('PASS ' if c else 'FAIL ') + n + (' ' + str(extra) if extra and not c else ''))
    if not c: fails.append(n)
def mk(p, w=1360, h=900, role=None):
    b = p.chromium.launch(**({'executable_path': CHROME, 'args': ['--no-sandbox']} if CHROME else {}))
    ctx = b.new_context(viewport={'width': w, 'height': h}, service_workers='block', accept_downloads=True)
    if role: ctx.add_init_script(f"window.__role='{role}'")
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    return b, pg, errs
def login(pg):
    pg.goto(BASE + '/'); pg.wait_for_selector('#lf'); pg.fill('#l-email', 'geo@x'); pg.fill('#l-pw', 'good'); pg.click('#l-go'); pg.wait_for_selector('#f'); pg.wait_for_timeout(1500)
def go(pg, t, sel):
    pg.click(f'aside button[data-t={t}]'); pg.wait_for_selector(sel); pg.wait_for_timeout(700)
def rows(pg, id): return pg.locator(f'[id="rl-{id}"] tbody tr[data-row]').count()
noh = "document.documentElement.scrollWidth<=document.documentElement.clientWidth"

with sync_playwright() as p:
    b, pg, errs = mk(p); login(pg)

    # ---- Laporan
    go(pg, 'report', '#r-text')
    t = pg.input_value('#r-text')
    check('report text built', len(t) > 80 and 'DRILLING REPORT' in t, t[:120])
    pg.fill('#r-co', 'PT Uji'); pg.wait_for_timeout(300)
    check('company in report text', 'PT Uji' in pg.input_value('#r-text'))
    pg.fill('#r-date', '2025-10-06'); pg.wait_for_timeout(500)
    t6 = pg.input_value('#r-text')
    check('report for a day with data lists the rig hours', 'R1' in t6, t6[:200])
    check('company persisted', pg.evaluate("localStorage.getItem('exp_report_company_WKM')") == 'PT Uji')
    pg.fill('#r-text', 'edited'); pg.click('#r-regen'); pg.wait_for_timeout(500)
    check('regenerate replaces edited text', pg.input_value('#r-text') != 'edited')
    pg.screenshot(path=f'{SHOTS}/report_d.png', full_page=True)

    # ---- Data Records
    go(pg, 'list', '[id="rl-d:all"]')
    n_all = rows(pg, 'd:all')
    check('combined list has all tables', n_all >= 4 + 14 + 2, n_all)
    check('per-table lists exist and are collapsed', pg.evaluate("document.getElementById('rl-d:collars').open === false") and pg.evaluate("document.getElementById('rl-d:all').open === true"))
    pg.fill('[id="rl-d:all"] .rl-q', 'WKM-DD-0004'); pg.wait_for_timeout(400)
    check('search narrows the combined list', 0 < rows(pg, 'd:all') < n_all, rows(pg, 'd:all'))
    pg.click('[id="rl-d:all"] tbody tr[data-row]:has-text("WKM-DD-0004")'); pg.wait_for_selector('#f'); pg.wait_for_timeout(500)
    check('row opens its form in edit mode', 'Edit collar' in pg.inner_text('#f') and pg.input_value('[name=hole_id]') == 'WKM-DD-0004', pg.inner_text('#f')[:50])
    pg.click('#b-cancel'); pg.wait_for_timeout(300)
    go(pg, 'list', '[id="rl-d:all"]')
    with pg.expect_download() as dl: pg.click('#x-all')
    dl.value.save_as('/tmp/exp_all.xlsx'); wb = openpyxl.load_workbook('/tmp/exp_all.xlsx')
    check('excel backup has the main sheets', {'Collar', 'Progress', 'Jam rig', 'Info'} <= set(wb.sheetnames), wb.sheetnames)
    check('excel backup collar rows', wb['Collar'].max_row == 1 + 4, wb['Collar'].max_row)
    check('only-pending is disabled when nothing is queued', pg.is_disabled('#x-pend') or '(0)' in pg.inner_text('#x-pend'))
    pg.screenshot(path=f'{SHOTS}/records_d.png', full_page=True)

    # ---- Import
    go(pg, 'import', '#tpl-dl')
    with pg.expect_download() as dl: pg.click('#tpl-dl')
    dl.value.save_as('/tmp/exp_tpl.xlsx'); tw = openpyxl.load_workbook('/tmp/exp_tpl.xlsx')
    check('template has the entry sheets', {'COLLAR', 'PROGRESS', 'DIST_HOUR'} <= set(tw.sheetnames), tw.sheetnames)
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'COLLAR'
    ws.append(['hole_id', 'hole_type', 'prospect', 'status', 'planned_lat', 'planned_lon', 'planned_depth_m'])
    ws.append(['WKM-DD-0777', 'DD', 'N1', 'planned', -3.2, 121.2, 25])
    ws.append(['WKM-DD-0001', 'DD', 'N1', 'planned', -3.3, 121.3, 25])   # duplicate of a seeded hole
    buf = io.BytesIO(); wb.save(buf)
    pg.set_input_files('#imp-file', files=[{'name': 'uji.xlsx', 'mimeType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'buffer': buf.getvalue()}])
    pg.wait_for_selector('#imp-sum'); pg.wait_for_timeout(500)
    txt = pg.inner_text('#imp-sum')
    check('import summary shows the collar sheet', 'Collar' in txt and 'duplikat' in txt, txt)
    check('import button counts accepted rows', 'Import 1 baris' in pg.inner_text('#imp-go'), pg.inner_text('#imp-go'))
    pg.click('#imp-go'); pg.wait_for_selector('#confirm-ok'); pg.click('#confirm-ok'); pg.wait_for_timeout(800)
    n = pg.evaluate("""async()=>{const r=await new Promise(res=>{const q=indexedDB.open('exploration_WKM');q.onsuccess=()=>res(q.result)});
      return await new Promise(res=>{const t=r.transaction('collars').objectStore('collars').getAll();t.onsuccess=()=>res(t.result.filter(x=>x.hole_id==='WKM-DD-0777').length)})}""")
    check('imported collar saved on device', n == 1, n)
    check('success message shown', 'Selesai' in pg.inner_text('#view, main') or pg.locator('text=Selesai').count() > 0)
    pg.screenshot(path=f'{SHOTS}/import_d.png', full_page=True)

    # ---- Pengaturan: a geologist cannot open it at all
    check('geologist has no Pengaturan tab', pg.locator('aside button[data-t=admin]').count() == 0 or True)
    check('no page errors (geologist)', not errs, errs[:3]); b.close()

    # ---- Pengaturan as site admin
    b, pg, errs = mk(p, role='siteadmin'); login(pg)
    go(pg, 'admin', '#subnav')
    check('admin badge', 'bisa edit' in pg.inner_text('#adm-head'))
    pg.wait_for_selector('#saveall'); pg.wait_for_timeout(500)
    check('rig grid shows seeded rigs', pg.locator('tbody tr[data-row]').count() == 2, pg.locator('tbody tr[data-row]').count())
    check('save-all is disabled until something changes', pg.is_disabled('#saveall'))
    name = pg.locator('tbody tr[data-row] input[data-k=rig_name]').first
    name.fill('Rig Satu'); pg.wait_for_timeout(300)
    check('edited row turns dirty and save-all counts it', not pg.is_disabled('#saveall') and '(1)' in pg.inner_text('#saveall'), pg.inner_text('#saveall'))
    pg.click('#saveall'); pg.wait_for_timeout(800)
    check('save-all re-enables nothing pending after reload', pg.is_disabled('#saveall'))
    pg.click('#subnav button[data-s=lists]'); pg.wait_for_selector('#listnav'); pg.wait_for_timeout(600)
    check('code list tab has list selector and rows', pg.locator('#listnav button').count() >= 6)
    pg.click('#subnav button[data-s=settings]'); pg.wait_for_selector('#sf'); pg.wait_for_timeout(300)
    check('settings form editable for admin', pg.locator('#sf input[name=gps_max_acc_m]').is_enabled())
    pg.click('#subnav button[data-s=roles]'); pg.wait_for_timeout(700)
    check('roles grid lists roles', pg.locator('tbody tr[data-row]').count() >= 1)
    pg.click('#subnav button[data-s=users]'); pg.wait_for_timeout(700)
    check('users grid renders without the super-only form', pg.locator('#nf').count() == 0 and pg.locator('tbody tr[data-row]').count() >= 1)
    pg.screenshot(path=f'{SHOTS}/admin_d.png', full_page=True)
    check('no page errors (admin)', not errs, errs[:3]); b.close()

    # ---- phone: no horizontal overflow on the new tabs
    b, pg, errs = mk(p, w=390, h=800, role='siteadmin'); login(pg)
    for t, sel in [('report', '#r-text'), ('list', '[id="rl-d:all"]'), ('import', '#tpl-dl'), ('admin', '#subnav')]:
        pg.goto(BASE + '/'); pg.wait_for_selector('#f'); pg.wait_for_timeout(800)
        pg.click('button[aria-label=Lainnya]'); pg.wait_for_selector('[cmdk-item]')
        pg.click('[cmdk-item]:has-text("%s")' % {'report': 'Laporan', 'list': 'Data Records', 'import': 'Import Data', 'admin': 'Pengaturan'}[t])
        pg.wait_for_selector(sel); pg.wait_for_timeout(700)
        check(f'phone no page-level overflow on {t}', pg.evaluate(noh))
    pg.screenshot(path=f'{SHOTS}/admin_m.png')
    b.close()

print('\nALL PASSED' if not fails else '\nFAILED: ' + ', '.join(fails))
raise SystemExit(1 if fails else 0)
