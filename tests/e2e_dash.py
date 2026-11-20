# Browser checks for Phase 3a (Dashboard, Data QC) on the test build with a fake Supabase.
#   npm run build:test && (cd out-test && python3 -m http.server 8801 &) && python3 tests/e2e_dash.py
import os
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8801'); SHOTS = os.environ.get('SHOTS', '/tmp/shots-next'); os.makedirs(SHOTS, exist_ok=True)
CHROME = os.environ.get('CHROME'); fails = []
def check(n, c, extra=''):
    print(('PASS ' if c else 'FAIL ') + n + (' ' + str(extra) if extra and not c else ''))
    if not c: fails.append(n)
def mk(p, w=1360, h=900):
    b = p.chromium.launch(**({'executable_path': CHROME, 'args': ['--no-sandbox']} if CHROME else {}))
    ctx = b.new_context(viewport={'width': w, 'height': h}, service_workers='block', accept_downloads=True)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    return b, pg, errs
def login(pg):
    pg.goto(BASE + '/'); pg.wait_for_selector('#lf'); pg.fill('#l-email', 'geo@x'); pg.fill('#l-pw', 'good'); pg.click('#l-go'); pg.wait_for_selector('#f'); pg.wait_for_timeout(1500)
def go(pg, t, sel):
    pg.click(f'aside button[data-t={t}]'); pg.wait_for_selector(sel, timeout=15000); pg.wait_for_timeout(1500)
noh = "document.documentElement.scrollWidth<=document.documentElement.clientWidth"

with sync_playwright() as p:
    b, pg, errs = mk(p); login(pg)
    # ---- Dashboard
    go(pg, 'dash', '#dash')
    check('dashboard canvases drawn', pg.locator('#dash canvas').count() >= 4, pg.locator('#dash canvas').count())
    check('chart cards present', pg.locator('[data-chart]').count() >= 4, pg.locator('[data-chart]').count())
    check('rig filter has R1/R2', pg.locator('#fRig option').count() >= 3, pg.locator('#fRig option').count())
    pg.select_option('#fRig', 'R1'); pg.wait_for_timeout(600)
    check('filter keeps charts', pg.locator('#dash canvas').count() >= 4)
    pg.click('#fReset'); pg.wait_for_timeout(300)
    pg.locator('[data-chart] button[data-t]').first.click(); pg.wait_for_timeout(300)
    check('chart/table toggle shows a table', pg.locator('[data-chart] table').count() >= 1)
    pg.screenshot(path=f'{SHOTS}/dash_d.png', full_page=True)
    check('dashboard no horizontal scroll', pg.evaluate(noh))
    pg.click('#d-refresh'); pg.wait_for_timeout(800)
    check('refresh keeps dashboard', pg.locator('#dash canvas').count() >= 4)

    # ---- Data QC
    go(pg, 'qc', '#qc')
    check('qc kpis shown', pg.locator('#q-kpis > *').count() == 6, pg.locator('#q-kpis > *').count())
    check('issues table has rows', pg.locator('tr[data-issue]').count() >= 1, pg.locator('tr[data-issue]').count())
    pg.select_option('#f-sev', 'critical'); pg.wait_for_timeout(300)
    n_crit = pg.locator('tr[data-issue]').count()
    pg.select_option('#f-sev', ''); pg.wait_for_timeout(300)
    check('severity filter narrows', n_crit <= pg.locator('tr[data-issue]').count())
    pg.screenshot(path=f'{SHOTS}/qc_geo.png', full_page=True)
    pg.click('#q-sub button[data-s=qaqc]'); pg.wait_for_selector('#q-batches'); pg.wait_for_timeout(1200)
    check('batch table', pg.locator('#q-batches tbody tr').count() >= 1)
    check('qaqc charts drawn', pg.locator('#q-grid canvas').count() >= 3, pg.locator('#q-grid canvas').count())
    pg.screenshot(path=f'{SHOTS}/qc_qaqc.png', full_page=True)
    pg.click('#q-sub button[data-s=lab]'); pg.wait_for_selector('#lab-pick button', timeout=20000); pg.wait_for_timeout(1500)
    n_sheets = pg.locator('#lab-pick button').count()
    check('lab sheets listed', n_sheets >= 5, n_sheets)
    check('lab table rendered', pg.locator('#lab-table table').count() == 1)
    pg.locator('#lab-pick button').nth(2).click(); pg.wait_for_timeout(800)
    check('lab sheet switch', pg.locator('#lab-table table').count() == 1)
    pg.screenshot(path=f'{SHOTS}/qc_lab.png', full_page=True)
    with pg.expect_download() as dl: pg.click('#q-lab')
    dl.value.save_as('/tmp/lab.xlsx')
    with pg.expect_download() as dl: pg.click('#q-xls')
    dl.value.save_as('/tmp/issues.xlsx')
    import openpyxl
    check('lab workbook opens', len(openpyxl.load_workbook('/tmp/lab.xlsx').sheetnames) >= 5)
    check('issues workbook sheets', {'Issues', 'Batches', 'CRM'} <= set(openpyxl.load_workbook('/tmp/issues.xlsx').sheetnames))
    pg.click('#q-sub button[data-s=thr]'); pg.wait_for_selector('#q-thr'); 
    check('thresholds table', pg.locator('#q-thr tbody tr').count() >= 10)
    check('qc no horizontal scroll', pg.evaluate(noh))
    # theme switch keeps charts
    pg.evaluate("document.documentElement.setAttribute('data-theme','dark')"); pg.wait_for_timeout(600)
    pg.screenshot(path=f'{SHOTS}/qc_dark.png', full_page=True)

    # ---- Dashboard collar map (Leaflet vendored)
    go(pg, 'dash', '#dash'); pg.wait_for_selector('#g-map.leaflet-container', timeout=15000); pg.wait_for_timeout(800)
    check('dashboard map canvas drawn (markers use canvas)', pg.locator('#g-map canvas').count() >= 1)
    # ---- Peta
    go(pg, 'map', '#map.leaflet-container')
    pg.wait_for_timeout(1000)
    check('peta collar markers', pg.locator('#map path.leaflet-interactive').count() == 4, pg.locator('#map path.leaflet-interactive').count())
    check('peta layer panel', pg.locator('.mlp-row').count() == 3, pg.locator('.mlp-row').count())
    pg.locator('.mlp-row input[data-a=vis]').first.uncheck(); pg.wait_for_timeout(300)
    check('hide a collar class', pg.locator('#map path.leaflet-interactive').count() < 4)
    pg.locator('.mlp-row input[data-a=vis]').first.check()
    pg.click('#mlm summary'); pg.wait_for_selector('#ml-file'); 
    import json
    open('/tmp/iup.geojson', 'w').write(json.dumps({'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'name': 'IUP'}, 'geometry': {'type': 'Polygon', 'coordinates': [[[121.0, -3.0], [121.2, -3.0], [121.2, -3.2], [121.0, -3.2], [121.0, -3.0]]]}}]}))
    pg.set_input_files('#ml-file', '/tmp/iup.geojson'); pg.fill('#ml-name', 'IUP test'); pg.click('#ml-go'); pg.wait_for_timeout(1500)
    check('layer upload listed', pg.locator('#mlm-box table.grid tbody tr').count() == 1 and pg.locator('.mlp-row').count() == 4, pg.locator('.mlp-row').count())
    pg.click('.mlp-toggle') if pg.locator('.mlp').first.is_hidden() else None
    pg.click('#mlp-pdf'); pg.wait_for_selector('.mpdf form'); check('pdf dialog opens', pg.locator('.mpdf input[name=title]').count() == 1)
    pg.screenshot(path=f'{SHOTS}/peta_d.png'); pg.click('#pdf-x')
    pg.click('[data-del]'); pg.wait_for_timeout(500); pg.keyboard.press('Enter'); pg.wait_for_timeout(800)
    pg.screenshot(path=f'{SHOTS}/peta_d2.png', full_page=True)
    check('peta no horizontal scroll', pg.evaluate(noh))

    # ---- Dashboard exports
    go(pg, 'dash', '#dash')
    import openpyxl
    with pg.expect_download() as dl: pg.click('#d-xlsx')
    dl.value.save_as('/tmp/dash.xlsx'); check('dashboard xlsx opens', len(openpyxl.load_workbook('/tmp/dash.xlsx').sheetnames) >= 3)
    with pg.expect_download(timeout=60000) as dl: pg.click('#d-pdf')
    dl.value.save_as('/tmp/dash.pdf'); head = open('/tmp/dash.pdf', 'rb').read(5); size = os.path.getsize('/tmp/dash.pdf')
    check('dashboard pdf is a pdf with content', head == b'%PDF-' and size > 20000, size)
    # ---- RoA Lab (a PDF that is not a lab report must be refused with a clear message, proving pdf.js runs)
    from reportlab.pdfgen import canvas
    c = canvas.Canvas('/tmp/notroa.pdf'); c.drawString(72, 700, 'Hello, this is not a lab report'); c.save()
    go(pg, 'roa', '#roa h2'); pg.set_input_files('#roa-file', '/tmp/notroa.pdf'); pg.wait_for_selector('#roa-msg .msg.err', timeout=20000)
    check('roa refuses a non-report pdf', 'Tabel hasil' in pg.inner_text('#roa-msg'), pg.inner_text('#roa-msg'))
    errs = [e for e in errs if 'Tabel hasil tidak ditemukan' not in e]   # logged on purpose by the RoA view for the refused test PDF
    check('no console errors', not errs, errs[:3])
    b.close()
    # ---- phone
    b, pg, errs = mk(p, 390, 800); login(pg)
    pg.click('button[aria-label=Lainnya]'); pg.wait_for_timeout(400)
    pg.click('[cmdk-item]:has-text("Dashboard")'); pg.wait_for_selector('#dash', timeout=15000); pg.wait_for_timeout(1500)
    check('phone dashboard no h-scroll', pg.evaluate(noh))
    pg.screenshot(path=f'{SHOTS}/dash_phone.png', full_page=True)
    check('phone no console errors', not errs, errs[:3]); b.close()
print('FAILS:', fails); raise SystemExit(1 if fails else 0)
