# Browser checks for Phase 4 (3D Hole) on the test build with a fake Supabase.
#   npm run build:test && (cd out-test && python3 -m http.server 8801 &) && python3 tests/e2e_3d.py
import os, io
from playwright.sync_api import sync_playwright
from PIL import Image
BASE = os.environ.get('BASE', 'http://localhost:8801'); SHOTS = os.environ.get('SHOTS', '/tmp/shots-next'); os.makedirs(SHOTS, exist_ok=True)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome'); fails = []
def check(n, c, extra=''):
    print(('PASS ' if c else 'FAIL ') + n + (' ' + str(extra) if extra and not c else ''))
    if not c: fails.append(n)
ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
def mk(p, w=1360, h=900, init=None):
    b = p.chromium.launch(executable_path=CHROME, args=ARGS)
    ctx = b.new_context(viewport={'width': w, 'height': h}, service_workers='block')
    ctx.add_init_script("Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8})")   # the CI box has 2 cores, which would count as low power
    if init: ctx.add_init_script(init)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    return b, pg, errs
def login(pg):
    pg.goto(BASE + '/'); pg.wait_for_selector('#lf'); pg.fill('#l-email', 'geo@x'); pg.fill('#l-pw', 'good'); pg.click('#l-go'); pg.wait_for_selector('#f'); pg.wait_for_timeout(1200)
def open3d(pg):
    pg.click('aside button[data-t=d3]'); pg.wait_for_selector('#d3-view', timeout=15000); pg.wait_for_timeout(1800)
def shot(pg, sel):
    return pg.locator(sel).screenshot()
def colours(png):
    im = Image.open(io.BytesIO(png)).convert('RGB').resize((160, 100)); px = list(im.getdata())
    base = max(set(px), key=px.count)
    return sum(1 for q in px if sum(abs(a - b) for a, b in zip(q, base)) > 60), len(px)
noh = "document.documentElement.scrollWidth<=document.documentElement.clientWidth"

with sync_playwright() as p:
    b, pg, errs = mk(p); login(pg)
    check('3D Hole tab in the sidebar', pg.locator('aside button[data-t=d3]').count() == 1)
    open3d(pg)
    note = pg.inner_text('#d3-note')
    check('4 holes loaded', '4 holes' in note, note)
    check('starts in 3D with a canvas', pg.locator('#d3-stage canvas').count() == 1)
    pg.wait_for_timeout(1500)
    png = shot(pg, '#d3-stage'); open(f'{SHOTS}/d3_class.png', 'wb').write(png)
    n, tot = colours(png)
    check('3D scene is drawn (not an empty canvas)', n > 40, n)
    # colour modes repaint
    imgs = {'cls': png}
    for k in ['ni', 'fe', 'mgo']:
        pg.click(f'#d3-view button[data-k={k}]'); pg.wait_for_timeout(900); imgs[k] = shot(pg, '#d3-stage')
    check('colour mode changes the picture', imgs['ni'] != imgs['cls'] and imgs['fe'] != imgs['ni'], '')
    check('legend follows the mode', 'MgO' in pg.inner_text('#d3-legend'), pg.inner_text('#d3-legend'))
    pg.click('#d3-view button[data-k=cls]'); pg.wait_for_timeout(600)
    check('legend lists the 5 classes', all(k in pg.inner_text('#d3-legend') for k in ['LIM', 'CEK', 'SAP', 'RSAP', 'BRK']))
    # orbit: drag rotates
    before = shot(pg, '#d3-stage'); box = pg.locator('#d3-stage').bounding_box()
    pg.mouse.move(box['x'] + 300, box['y'] + 200); pg.mouse.down(); pg.mouse.move(box['x'] + 420, box['y'] + 240, steps=8); pg.mouse.up(); pg.wait_for_timeout(700)
    after = shot(pg, '#d3-stage'); check('dragging rotates the view', before != after)
    pg.click('#d3-reset'); pg.wait_for_timeout(700); check('reset view restores the first picture', shot(pg, '#d3-stage') == before)
    # vertical exaggeration and labels re-render
    pg.evaluate("(()=>{const e=document.getElementById('d3-exag');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(e,'3');e.dispatchEvent(new Event('input',{bubbles:true}))})()"); pg.wait_for_timeout(900)
    check('vertical exaggeration changes the scene', shot(pg, '#d3-stage') != before)
    pg.evaluate("(()=>{const e=document.getElementById('d3-exag');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(e,'1');e.dispatchEvent(new Event('input',{bubbles:true}))})()"); pg.wait_for_timeout(600)
    pg.uncheck('#d3-labels'); pg.wait_for_timeout(600); check('labels toggle changes the scene', shot(pg, '#d3-stage') != before); pg.check('#d3-labels')
    # hole list selects and opens detail
    rows = pg.locator('#d3-list tbody tr'); check('hole list has 4 rows', rows.count() == 4, rows.count())
    rows.nth(0).click(); pg.wait_for_selector('#d3-detail'); d = pg.inner_text('#d3-detail')
    check('detail shows hole, depth and an interval', 'WKM-DD-0001' in d and '30' in d and 'LIM' in d, d[:200])
    rows.nth(1).click(); pg.wait_for_timeout(300); d = pg.inner_text('#d3-detail')
    check('detail follows selection, survey noted', 'WKM-DD-0002' in d and 'surveyed' in d and 'SAP' in d, d[:200])
    pg.screenshot(path=f'{SHOTS}/d3_page_d.png', full_page=True)
    # click inside the canvas picks a hole (centre of the scene has holes)
    pg.click('#d3-detail button:has-text("Close")'); pg.wait_for_timeout(300)
    check('detail closes', pg.locator('#d3-detail').count() == 0)
    # prospect filter
    opts = pg.locator('#d3-pros option').all_inner_texts(); check('prospect filter lists N1 and S2', 'N1' in opts and 'S2' in opts, opts)
    pg.select_option('#d3-pros', 'N1'); pg.wait_for_timeout(600)
    check('filter keeps 2 holes', '2 holes' in pg.inner_text('#d3-note') and pg.locator('#d3-list tbody tr').count() == 2, pg.inner_text('#d3-note'))
    pg.select_option('#d3-pros', '')
    # plan + section view
    pg.click('#d3-view button[data-k="2d"]'); pg.wait_for_selector('#d3-plan'); pg.wait_for_timeout(300)
    check('plan and section drawn', pg.locator('#d3-plan line').count() >= 4 and pg.locator('#d3-sec line').count() >= 4, (pg.locator('#d3-plan line').count(), pg.locator('#d3-sec line').count()))
    s0 = pg.inner_html('#d3-sec'); pg.select_option('#d3-az', '0'); pg.wait_for_timeout(300)
    check('section bearing changes the section', pg.inner_html('#d3-sec') != s0)
    check('3D canvas is gone in 2D', pg.locator('#d3-stage').count() == 0)
    pg.locator('#d3-plan g').first.click(); pg.wait_for_selector('#d3-detail'); check('click a collar in the plan selects it', True)
    pg.screenshot(path=f'{SHOTS}/d3_2d_d.png', full_page=True)
    check('no page errors', not [e for e in errs if 'GL Driver' not in e and 'GPU stall' not in e], errs[:3])
    b.close()

    # low-power device starts in the simple view, 3D stays available
    b, pg, errs = mk(p, init="Object.defineProperty(navigator,'deviceMemory',{get:()=>1})"); login(pg); open3d(pg)
    check('low-power device starts in plan + section', pg.locator('#d3-plan').count() == 1 and pg.locator('#d3-low').count() == 1)
    pg.click('#d3-view button[data-k="3d"]'); pg.wait_for_timeout(1800)
    check('3D can still be chosen on a low-power device', pg.locator('#d3-stage canvas').count() == 1)
    b.close()

    # no WebGL at all
    b, pg, errs = mk(p, init="(()=>{const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){if(/webgl/.test(t))return null;return g.call(this,t,...a)}})()"); login(pg); open3d(pg)
    check('no WebGL: simple view and a note', pg.locator('#d3-plan').count() == 1 and pg.locator('#d3-nogl').count() == 1)
    check('no WebGL: no 3D button problems, no errors', not errs, errs[:2])
    b.close()

    # phone
    b, pg, errs = mk(p, 390, 800); login(pg)
    pg.click('button[aria-label=Lainnya]'); pg.wait_for_timeout(400)
    pg.click('[cmdk-item]:has-text("3D Hole")'); pg.wait_for_selector('#d3-view', timeout=15000); pg.wait_for_timeout(1800)
    check('phone: no horizontal scroll', pg.evaluate(noh))
    check('phone: scene visible', pg.locator('#d3-stage canvas, #d3-plan').count() >= 1)
    pg.screenshot(path=f'{SHOTS}/d3_phone.png', full_page=True)
    b.close()

print('FAILS:', fails)
