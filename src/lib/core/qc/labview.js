// "Lab Analysis" sub-tab of Data QC: every sheet of the lab-analysis Excel workbook, shown inside the app.
// It renders the same sheet models that js/lab/workbook.js writes to .xlsx (tables, heat-map colours, PASS/FAIL colours and charts),
// so the app and the Excel file always show the same numbers. Charts use Chart.js; no data leaves the device.
import { esc, baseOptions, COLOR, keepChart } from '../dash/ui.js';

export const PAGE_CHARTS = 9, MAX_ROWS = 400;
const colIdx = s => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const cellVal = c => (c === null || c === undefined ? null : typeof c === 'object' ? (c.err ? null : c.v ?? null) : c);
const serialDate = n => new Date(Math.round((n - 25569) * 864e5)).toISOString().slice(0, 10);
const FMT = { n0: 0, n2: 2, n3: 3, n4: 4, in1: 0, in2: 2, in3: 3 };
const fmt = c => {
  if (c === null || c === undefined) return '';
  const o = typeof c === 'object' ? c : { v: c }; if (o.err) return '';
  const v = o.v; if (v === null || v === undefined || v === '') return '';
  if (typeof v !== 'number') return String(v);
  if (o.s === 'date') return serialDate(v); if (o.s === 'pct' || o.s === 'inpct') return (v * 100).toFixed(1) + '%';
  return o.s in FMT ? v.toFixed(FMT[o.s]) : Number.isInteger(v) ? String(v) : String(+v.toFixed(4));
};
const parseRange = s => { const m = /^\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/.exec(s); return m ? { c1: colIdx(m[1]), r1: +m[2], c2: colIdx(m[3] || m[1]), r2: +(m[4] || m[2]) } : null; };
const hex = (argb, d) => { const h = argb.slice(-6); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));

// values of a chart reference such as Downhole_Plot!$I$8:$I$20
function rangeOf(model, ref, here) {
  const m = /^'?([^'!]+)'?!(.+)$/.exec(ref), sh = model.get(m ? m[1] : here), r = parseRange(m ? m[2] : ref); if (!sh || !r) return [];
  const out = []; for (let i = r.r1; i <= r.r2; i++) for (let j = r.c1; j <= r.c2; j++) out.push(cellVal(sh.rows[i - 1]?.[j])); return out;
}
const num = v => (typeof v === 'number' && isFinite(v) ? v : null);

export function chartConfig(sp, model, here) {
  const ink = COLOR.ink, grid = { color: COLOR.grid, drawTicks: false }, tick = { color: ink, font: { size: 11 } };
  const col = (s, i) => '#' + (s.color || ['2E75B6', 'C00000', '70AD47', 'FFC000', '7030A0', 'ED7D31', '00B0F0', '7F7F7F'][i % 8]);
  const axis = (a = {}, extra = {}) => ({ min: a.min, max: a.max, reverse: !!a.reverse, grid, border: { display: false }, ticks: tick, title: a.title ? { display: true, text: a.title, color: ink } : undefined, ...extra });
  const base = baseOptions({ legend: sp.legend !== false });
  base.plugins.title = { display: !!sp.title, text: sp.title, color: ink, font: { size: 13, weight: '600' } };
  if (sp.type === 'scatter' || sp.type === 'bubble') {
    const bub = sp.type === 'bubble', mx = bub ? Math.max(1e-9, ...sp.series.flatMap(s => rangeOf(model, s.size, here).map(num).filter(v => v != null))) : 1;
    const datasets = sp.series.map((s, i) => { const x = rangeOf(model, s.x, here), y = rangeOf(model, s.y, here), z = bub ? rangeOf(model, s.size, here) : [];
      const data = x.map((xv, k) => ({ x: num(xv), y: num(y[k]), r: bub ? 3 + 15 * (num(z[k]) || 0) / mx : undefined })).filter(p => p.x != null && p.y != null);
      const line = !!s.line, marker = s.marker !== undefined ? s.marker : !line;
      return { label: s.name, data, showLine: line, borderColor: col(s, i), backgroundColor: col(s, i) + (bub ? 'aa' : ''), borderWidth: line ? 1.6 : 1, borderDash: s.dash ? [5, 4] : [], pointRadius: bub ? undefined : marker ? 3 : 0, pointHoverRadius: 5, tension: 0 }; });
    return { type: sp.type, data: { datasets }, options: { ...base, interaction: { mode: 'nearest', intersect: true }, scales: { x: axis(sp.x, { type: 'linear' }), y: axis(sp.y, { type: 'linear' }) } } };
  }
  const labels = sp.series[0] ? rangeOf(model, sp.series[0].cat, here).map(v => (v == null ? '' : String(v))) : [];
  const datasets = sp.series.map((s, i) => ({ label: s.name, data: rangeOf(model, s.y, here).map(num), borderColor: col(s, i), backgroundColor: col(s, i), borderWidth: s.line ? 1.6 : 0, borderDash: s.dash ? [5, 4] : [],
    pointRadius: s.marker === false ? 0 : 3, tension: 0, spanGaps: false, maxBarThickness: 26, borderRadius: sp.type === 'bar' ? { topLeft: 3, topRight: 3 } : 0 }));
  return { type: sp.type, data: { labels, datasets }, options: { ...base, scales: { x: { grid: { display: false }, ticks: { ...tick, maxRotation: 45, autoSkipPadding: 10 }, title: sp.x?.title ? { display: true, text: sp.x.title, color: ink } : undefined }, y: axis(sp.y, { beginAtZero: sp.y?.min === 0 }) } } };
}

export function tableHtml(sh) {
  const rows = sh.rows, n = Math.min(rows.length, MAX_ROWS + 6); let ncol = 0; rows.forEach(r => { if (r && r.length > ncol) ncol = r.length; });
  const heat = new Map(), cfc = new Map();
  (sh.scale || []).forEach(g => { const r = parseRange(g.sqref); if (!r) return; const vs = []; for (let i = r.r1; i <= r.r2; i++) for (let j = r.c1; j <= r.c2; j++) { const v = num(cellVal(rows[i - 1]?.[j])); if (v != null) vs.push(v); }
    if (!vs.length) return; const lo = Math.min(...vs), hi = Math.max(...vs), A = hex(g.lo || 'FF63BE7B'), M = [255, 235, 132], B = hex(g.hi || 'FFF8696B');
    for (let i = r.r1; i <= r.r2; i++) for (let j = r.c1; j <= r.c2; j++) { const v = num(cellVal(rows[i - 1]?.[j])); if (v == null) continue; const t = hi > lo ? (v - lo) / (hi - lo) : 0.5;
      const c = t < 0.5 ? mix(A, M, t * 2) : mix(M, B, (t - 0.5) * 2); heat.set(i + ',' + j, `background:rgb(${c});color:#1a1a1a`); } });
  (sh.cf || []).forEach(g => { const r = parseRange(g.sqref); if (!r) return; for (let i = r.r1; i <= r.r2; i++) for (let j = r.c1; j <= r.c2; j++) { const v = cellVal(rows[i - 1]?.[j]);
    for (const [k, bg] of [['fail', '#ffc7ce'], ['warn', '#ffeb9c'], ['pass', '#c6efce']]) if ((g[k] || []).includes(v)) cfc.set(i + ',' + j, `background:${bg};color:#1a1a1a`); } });
  let h = '<table class="lab-tbl"><tbody>';
  for (let i = 0; i < n; i++) { const r = rows[i]; if (!r) { h += '<tr><td class="lt-e" colspan="1"></td></tr>'; continue; }
    h += '<tr>'; for (let j = 0; j < ncol; j++) { const c = r[j], o = c && typeof c === 'object' ? c : null, s = o?.s || '', k = (i + 1) + ',' + j, w = j === 0 && s !== 'hdr' ? ' lt-l' : '';
      const txt = esc(fmt(c)), st = heat.get(k) || cfc.get(k) || '';
      if (s === 'title') { h += `<td class="lt-title" colspan="${ncol}">${txt}</td>`; break; }
      if (s === 'note' && j === 0) { h += `<td class="lt-note" colspan="${ncol}">${txt}</td>`; break; }
      h += `<td class="lt-${s || 'x'}${typeof cellVal(c) === 'number' ? ' lt-n' : w}"${st ? ` style="${st}"` : ''}>${txt}</td>`; }
    h += '</tr>'; }
  return h + '</tbody></table>' + (rows.length > n ? `<p class="muted small">First ${n} rows shown. The Excel download has all ${rows.length}.</p>` : '');
}

export function labTab(body, model, st) {
  const names = [...model.keys()]; if (!model.get(st.labSheet)) st.labSheet = names[0];
  const sh = model.get(st.labSheet), allCh = sh.charts || [];
  body.innerHTML = `<div class="card w12"><div class="card-head"><div><h3>Lab analysis</h3><p class="sub">The same ${names.length} sheets as the Excel download, computed from your data. Charts, heat-map colours and PASS / FAIL colours match the workbook. Limits come from the Parameter sheet (edit them in Excel).</p></div></div>
    <div class="seg lab-seg" id="lab-pick">${names.map(n => `<button data-n="${esc(n)}" class="${n === st.labSheet ? 'on' : ''}">${esc(n.replace(/_/g, ' '))}</button>`).join('')}</div>
    <div id="lab-charts" class="lab-grid"></div><div id="lab-more"></div><div class="tw lab-wrap" id="lab-table"></div></div>`;
  body.querySelector('#lab-pick').onclick = e => { const n = e.target.dataset.n; if (n) { st.labSheet = n; st.labShown = PAGE_CHARTS; st.rerender(); } };
  const grid = body.querySelector('#lab-charts'), more = body.querySelector('#lab-more'); let shown = 0;
  const draw = upto => { for (; shown < Math.min(upto, allCh.length); shown++) { const sp = allCh[shown], box = document.createElement('div'); box.className = 'lab-chart'; box.innerHTML = '<canvas></canvas>'; grid.appendChild(box);
      try { keepChart(new Chart(box.firstChild, chartConfig(sp, model, sh.name))); } catch (e) { console.error(e); box.innerHTML = `<p class="muted small">${esc(sp.title || 'Chart')} could not be drawn.</p>`; } }
    more.innerHTML = shown < allCh.length ? `<div class="row actions"><button class="btn small" id="lab-more-b">Show more charts (${shown} of ${allCh.length})</button></div>` : '';
    const b = more.querySelector('#lab-more-b'); if (b) b.onclick = () => draw(shown + PAGE_CHARTS); };
  draw(PAGE_CHARTS);
  body.querySelector('#lab-table').innerHTML = tableHtml(sh);
}
