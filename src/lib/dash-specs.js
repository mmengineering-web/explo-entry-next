// @ts-nocheck
// Chart definitions for the Dashboard, taken from the vanilla js/dash/page.js. Each function returns a plain spec
// { title, sub, head, rows, tall, make(canvas) -> Chart } that <ChartCard> renders; no DOM work happens here.
import * as C from './core/dash/calc.js';
import { baseOptions, COLOR, SERIES, GAP, nf, nid } from './core/dash/ui.js';

const sc = i => SERIES[i % SERIES.length];

export function progressSpec(d, f, period) {
  const pb = C.progressBuckets(d, f, period);
  const labels = pb.rows.map(r => C.bucketLabel(period, r.b));
  return { id: 'prog', tall: true, title: 'Meters vs plan',
    sub: `${C.PERIODS[period].label} aggregation, ${C.PERIODS[period].note}${pb.hasPlan ? '' : '. Plan is a site total, hidden while a prospect or rig is selected'}.`,
    head: ['Period', ...pb.rigs.map(r => r.name + ' (m)'), 'Total (m)', 'Plan (m)'],
    rows: pb.rows.filter(r => r.total > 0 || r.plan > 0).map(r => [C.bucketLabel(period, r.b), ...pb.rigs.map(g => nf(r.rig[g.id], 1)), nf(r.total, 1), r.plan ? nf(r.plan, 1) : '-']),
    make: cv => {
      const o = baseOptions({ legend: true, yTitle: 'm', stacked: true });
      o.plugins.legend.position = 'bottom'; o.plugins.legend.align = 'start';
      o.plugins.tooltip.callbacks = { footer: items => { const r = pb.rows[items[0].dataIndex]; return `Total ${nf(r.total, 1)} m` + (r.plan ? ` / plan ${nf(r.plan, 1)} m` : ''); } };
      return new window.Chart(cv, { data: { labels, datasets: [
        ...pb.rigs.map((g, i) => ({ type: 'bar', label: g.name, data: pb.rows.map(r => Math.round(r.rig[g.id] * 10) / 10), backgroundColor: sc(i), ...GAP, maxBarThickness: 22, stack: 's', order: 2 })),
        ...(pb.hasPlan ? [{ type: 'line', label: 'Plan', data: pb.rows.map(r => (r.plan ? Math.round(r.plan * 10) / 10 : null)), borderColor: '#64748B', borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, spanGaps: true, order: 1 }] : [])] }, options: o });
    } };
}

export function hoursSpec(d, f) {
  const hb = C.hoursByRig(d, f);
  return { id: 'hours', title: 'Hours per activity per rig', sub: 'Last 60 days, Distribution Hour',
    head: ['Rig', ...hb.acts.map(a => a.label + ' (h)'), 'Total (h)'],
    rows: hb.rigs.map(r => [r.name, ...hb.acts.map(a => nf(r.h[a.code] || 0, 1)), nf(Object.values(r.h).reduce((t, x) => t + x, 0), 1)]),
    make: cv => {
      const o = baseOptions({ horizontal: true, legend: true, stacked: true, yTitle: '' });
      o.scales.x.title = { display: true, text: 'hours', color: COLOR.ink };
      o.plugins.legend.position = 'bottom'; o.plugins.legend.align = 'start';
      return new window.Chart(cv, { type: 'bar', data: { labels: hb.rigs.map(r => r.name), datasets: hb.acts.map((a, i) => ({ label: a.label, data: hb.rigs.map(r => Math.round((r.h[a.code] || 0) * 10) / 10), backgroundColor: sc(i), ...GAP, maxBarThickness: 22 })) }, options: o });
    } };
}

export const STAT = () => [['PENDING', 'Pending', SERIES[1]], ['SENT', 'Sent', SERIES[2]], ['ANALYZED', 'Analyzed', SERIES[0]]];
export function samplesSpec(sp) {
  const ST = STAT();
  return { id: 'sp', title: 'Sample status by prospect', sub: 'Count of samples',
    head: ['Prospect', ...ST.map(s => s[1])], rows: sp.map(x => [x.prospect, ...ST.map(s => nf(x[s[0]]))]),
    make: cv => { const o = baseOptions({ horizontal: true, legend: true, stacked: true }); o.plugins.legend.position = 'bottom'; o.plugins.legend.align = 'start'; o.scales.x.ticks.precision = 0;
      return new window.Chart(cv, { type: 'bar', data: { labels: sp.map(x => x.prospect), datasets: ST.map(([k, l, c]) => ({ label: l, data: sp.map(x => x[k]), backgroundColor: c, ...GAP, maxBarThickness: 22 })) }, options: o }); } };
}

// ---- QAQC Geokimia (Indonesian labels, numbers as 8.782 and 8,0%)
const dayNum = s => Date.parse(s + 'T00:00:00Z') / 864e5;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayId = n => { const x = new Date(Math.round(n) * 864e5); return `${String(x.getUTCDate()).padStart(2, '0')} ${MON[x.getUTCMonth()]}`; };
const STAT_ID = { pass: 'Lolos', fail: 'Gagal', warn: 'Perlu dicek' };
const refLabel = items => ({ id: 'refLabel', afterDatasetsDraw(ch) {
  const { ctx, chartArea: a, scales: { y } } = ch; ctx.save(); ctx.fillStyle = COLOR.ink; ctx.font = '11px Geist, system-ui, sans-serif'; ctx.textAlign = 'right';
  for (const [v, t] of items) ctx.fillText(t, a.right - 4, y.getPixelForValue(v) - 5);
  ctx.restore(); } });
function scatterOptions(xTitle, yTitle, tipFn) {
  const o = baseOptions({ legend: true });
  o.interaction = { mode: 'nearest', intersect: true };
  o.plugins.legend.position = 'bottom'; o.plugins.legend.align = 'start';
  o.plugins.legend.labels.filter = it => !it.text.startsWith('_');
  o.plugins.tooltip.filter = it => !it.dataset.label.startsWith('_');
  o.plugins.tooltip.callbacks = { title: () => '', label: tipFn };
  o.scales.x.type = 'linear'; o.scales.y.type = 'linear';
  o.scales.x.beginAtZero = o.scales.y.beginAtZero = true;
  o.scales.x.grid = { color: COLOR.grid, drawTicks: false }; o.scales.x.border = { display: false };
  o.scales.x.title = xTitle ? { display: true, text: xTitle, color: COLOR.ink } : undefined;
  o.scales.y.title = yTitle ? { display: true, text: yTitle, color: COLOR.ink } : undefined;
  return o;
}
const dot = (label, color, data) => ({ type: 'scatter', label, data, backgroundColor: color, borderColor: color, pointRadius: 3.5, pointHoverRadius: 6, pointHitRadius: 8 });
const guide = (label, data, color, dash) => ({ type: 'line', label: '_' + label, data, borderColor: color, borderWidth: 1, borderDash: dash || [], pointRadius: 0, pointHitRadius: 0, fill: false, order: 9 });

export function qaqcModel(d, f) {
  const fl = C.qaqcFlow(d, f), ck = C.qaqcChecks(d);
  return { fl, ck, t: fl.totals, T: ck.T };
}

export function flowSpec({ fl }) {
  const rows = fl.labels.map((x, i) => [x, fl.sent[i], fl.roa[i], fl.qaqc[i]]).filter(r => r[1] || r[2] || r[3]);
  return { id: 'q-flow', tall: true, title: 'Alur sampel: terkirim vs ROA vs excel QAQC', sub: 'Sampel per hari, 60 hari terakhir. ROA dan Excel QAQC dihitung pada tanggal data masuk.',
    head: ['Tanggal', 'Terkirim', 'ROA diinput', 'Excel QAQC selesai'], rows: rows.map(r => [r[0], ...r.slice(1).map(v => nid(v))]),
    make: cv => { const o = baseOptions({ legend: true, yTitle: 'sampel per hari' }); o.plugins.legend.position = 'bottom'; o.plugins.legend.align = 'start'; o.scales.y.ticks.precision = 0;
      o.scales.x.ticks.callback = function (v) { return dayId(dayNum(this.getLabelForValue(v))); }; o.plugins.tooltip.callbacks = { title: it => dayId(dayNum(fl.labels[it[0].dataIndex])) };
      const ln = (label, data, c) => ({ label, data, borderColor: c, backgroundColor: c, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0 });
      return new window.Chart(cv, { type: 'line', data: { labels: fl.labels, datasets: [ln('Terkirim', fl.sent, SERIES[0]), ln('ROA diinput', fl.roa, SERIES[1]), ln('Excel QAQC selesai', fl.qaqc, SERIES[2])] }, options: o }); } };
}

export function blankSpec({ ck, T }) {
  const bl = ck.blanks.filter(b => b.date);
  const xs = bl.map(b => dayNum(b.date)), x0 = xs.length ? Math.min(...xs) : 0, x1 = xs.length ? Math.max(...xs) : 1;
  const bPt = st => bl.filter(b => (b.status === 'fail') === (st === 'fail')).map(b => ({ x: dayNum(b.date), y: b.ni, n: b.sample_no, b: b.batch }));
  return { id: 'q-blank', tall: true, title: 'Blank, Ni (%)', sub: 'Setiap titik satu sampel blank; garis putus-putus = ambang kontaminasi.',
    head: ['Lab report', 'Blank', 'Tanggal', 'Ni (%)', 'Status'], rows: ck.blanks.map(b => [b.batch || '', b.sample_no, b.date || '', nid(b.ni, 3), STAT_ID[b.status] || b.status]),
    make: cv => { const o = scatterOptions('', '', c => `${c.raw.n}: Ni ${nid(c.raw.y, 3)}% (${c.raw.b || 'tanpa batch'}, ${dayId(c.raw.x)})`);
      o.scales.x.beginAtZero = false; o.scales.x.min = x0 - 1; o.scales.x.max = x1 + 1; o.scales.x.ticks = { ...o.scales.x.ticks, precision: 0, maxTicksLimit: 8, callback: v => dayId(v) };
      o.scales.y.ticks.callback = v => nid(v, 2).replace(/,?0+$/, '') || '0';
      return new window.Chart(cv, { type: 'scatter', data: { datasets: [dot('Lolos', SERIES[0], bPt('pass')), dot('Gagal', COLOR.fail, bPt('fail')), guide('ambang', [{ x: x0 - 1, y: T.blank_ni_max }, { x: x1 + 1, y: T.blank_ni_max }], COLOR.ink, [5, 4])] }, options: o,
        plugins: [refLabel([[T.blank_ni_max, `ambang ${nid(T.blank_ni_max, 2)}% Ni`]])] }); } };
}

export function dupSpec({ ck }) {
  const dd = ck.dups, mx = Math.max(0.1, ...dd.flatMap(x => [x.orig_ni, x.dup_ni])) * 1.08;
  const dPt = st => dd.filter(x => (x.status === 'fail') === (st === 'fail')).map(x => ({ x: x.orig_ni, y: x.dup_ni, n: x.sample_no, t: x.type, a: x.ard, m: x.max }));
  const lims = [...new Set(dd.map(x => x.max))].sort((a, b) => a - b);
  const slope = a => (2 + a) / (2 - a);
  return { id: 'q-dup', tall: true, title: 'Duplikat, original vs duplicate Ni (%)',
    sub: `Garis tengah = kesetaraan (y = x); garis putus-putus = batas selisih relatif (${lims.map(v => nid(v * 100) + '%').join(' / ') || '-'}).`,
    head: ['Lab report', 'Duplikat', 'Tipe', 'Ni asli (%)', 'Ni duplikat (%)', 'Selisih relatif (%)', 'Batas (%)', 'Status'],
    rows: dd.map(x => [x.batch || '', x.sample_no, x.type, nid(x.orig_ni, 3), nid(x.dup_ni, 3), nid(x.ard * 100, 1), nid(x.max * 100), STAT_ID[x.status] || x.status]),
    make: cv => { const o = scatterOptions('Original (% Ni)', 'Duplicate (% Ni)', c => `${c.raw.n} (${c.raw.t}): asli ${nid(c.raw.x, 3)}, duplikat ${nid(c.raw.y, 3)}, selisih ${nid(c.raw.a * 100, 1)}% (batas ${nid(c.raw.m * 100)}%)`);
      o.scales.x.max = o.scales.y.max = mx; o.scales.x.ticks = { ...o.scales.x.ticks, callback: v => nid(v, 1).replace(/,0$/, '') }; o.scales.y.ticks.callback = o.scales.x.ticks.callback;
      const line = (k, color, dash, lab) => guide(lab, [{ x: 0, y: 0 }, { x: mx, y: mx * k }], color, dash);
      return new window.Chart(cv, { type: 'scatter', data: { datasets: [dot('Lolos', SERIES[0], dPt('pass')), dot('Gagal', COLOR.fail, dPt('fail')), line(1, COLOR.ink, [], 'y=x'),
        ...lims.flatMap(a => [line(slope(a), COLOR.fail, [5, 4], 'atas ' + a), line(1 / slope(a), COLOR.fail, [5, 4], 'bawah ' + a)])] }, options: o }); } };
}
