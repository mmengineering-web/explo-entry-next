// Extra sheets of the lab-analysis workbook: Composite_Ni, Downhole_Plot, EDA_Scatter, QAQC_Charts and the four IDW maps.
// Same rules as workbook.js: every number is a live formula (reading Assay_Data / Collar / QAQC / Parameter) with the value
// pre-computed here, and every chart is a native Excel chart that reads worksheet cells.
import { colName } from '../xlsx-lite.js';
import { PAL } from './charts.js';

const MAXH = 24;                       // per-hole charts / series are capped so the file stays light
const NA = f => ({ f, err: '#N/A', v: '#N/A' });
const num = v => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const cl = i => colName(i);            // 0-based column letter
const sheetRows = () => { const rows = []; return { rows, set: (r, c, v) => { (rows[r - 1] ??= [])[c - 1] = v; } }; };
const niceMax = v => { if (!(v > 0)) return 1; const m = Math.pow(10, Math.floor(Math.log10(v))), st = m / 2; return Math.ceil(v / st) * st; };
const pearson = (xs, ys) => { const a = [], b = []; xs.forEach((x, i) => { if (x != null && ys[i] != null) { a.push(x); b.push(ys[i]); } }); const n = a.length; if (n < 3) return ''; const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return saa && sbb ? sab / Math.sqrt(saa * sbb) : ''; };
const med = a => { if (!a.length) return ''; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sd = a => { if (a.length < 2) return ''; const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const chartGrid = (n, r0, c0, w = 9, h = 20, per = 3) => Array.from({ length: n }, (_, i) => [c0 + (i % per) * w, r0 + Math.floor(i / per) * (h + 1), c0 + (i % per) * w + w, r0 + Math.floor(i / per) * (h + 1) + h]);

/* ================= Composite_Ni ================= */
export function compositeSheet(cx) {
  const { holes, hinfo, prim, p, pv, R, cfirst, clast, f, HDR, assayValue, title } = cx; const cut = pv('cutoff');
  const rows = [[{ v: 'Komposit Ore Ni per Lubang', s: 'title' }], [{ v: 'Ore = sampel dengan Ni ≥ cut-off (Parameter). Ketebalan = jumlah panjang sampel ore; Ni/Fe/MgO dibobot panjang. Kolom S–Z dipakai oleh sheet Map_*.', s: 'note' }], [], [],
    HDR(['Hole_ID', 'X (m)', 'Y (m)', 'RL (m)', 'EOH (m)', 'n sampel ore', 'Top ore (m)', 'Bottom ore (m)', 'Tebal ore (m)', 'Zona (m)', 'Waste internal (m)', 'Ni (%)', 'Fe (%)', 'MgO (%)', 'Z top (m)', 'Z bottom (m)', 'Ni × Tebal', 'Status', 'Lokasi valid', 'X valid', 'Y valid', 'Ore valid', 'v_Tebal', 'v_Ni', 'v_Fe', 'v_MgO'])];
  const data = [];
  holes.forEach((h, i) => {
    const r = cfirst + i, info = hinfo[h] || {}, hs = prim.filter(a => a.hole_id === h), ore = hs.filter(a => (assayValue(a, 'Ni') ?? -1) >= cut);
    const len = a => num(a.to_m) - num(a.from_m), thick = ore.reduce((s, a) => s + len(a), 0), n = ore.length;
    const top = n ? Math.min(...ore.map(a => num(a.from_m))) : '', bot = n ? Math.max(...ore.map(a => num(a.to_m))) : '';
    const wa = k => (thick ? ore.reduce((s, a) => s + (assayValue(a, k) ?? 0) * len(a), 0) / thick : '');
    const Ni = wa('Ni'), Fe = wa('Fe'), Mg = wa('MgO'), eoh = info.eoh || '';
    const X = info.X ?? '', Y = info.Y ?? '', RL = info.RL ?? '';
    const valid = X !== '' && Y !== '' ? 1 : 0, vore = valid && n > 0 ? 1 : 0;
    const status = !n ? 'Tidak ada ore' : bot >= eoh ? 'TERBUKA di EOH – tebal minimum' : 'Tertutup (Ni < cut-off di EOH)';
    const crit = `${R('A')},A${r},${R('H')},">="&${p('cutoff')}`;
    const wf = c => `IF(I${r}=0,"",SUMPRODUCT((${R('A')}=A${r})*(${R('H')}>=${p('cutoff')})*${R('E')}*${R(c)})/I${r})`;
    rows.push([f(`Collar!A${r}`, h), f(`IF(Collar!B${r}="","",Collar!B${r})`, X, 'n2'), f(`IF(Collar!C${r}="","",Collar!C${r})`, Y, 'n2'), f(`IF(Collar!D${r}="","",Collar!D${r})`, RL, 'n2'), f(`Collar!G${r}`, eoh, 'n2'),
      f(`COUNTIFS(${crit})`, n, 'n0'), f(`IF(F${r}=0,"",_xlfn.MINIFS(${R('C')},${crit}))`, top, 'n2'), f(`IF(F${r}=0,"",_xlfn.MAXIFS(${R('D')},${crit}))`, bot, 'n2'), f(`IF(F${r}=0,0,SUMIFS(${R('E')},${crit}))`, thick, 'n2'),
      f(`IF(F${r}=0,"",H${r}-G${r})`, n ? bot - top : '', 'n2'), f(`IF(F${r}=0,"",J${r}-I${r})`, n ? bot - top - thick : '', 'n2'),
      f(wf('H'), Ni, 'n3'), f(wf('I'), Fe, 'n2'), f(wf('K'), Mg, 'n2'),
      f(`IF(OR(G${r}="",D${r}=""),"",D${r}-G${r})`, n && RL !== '' ? RL - top : '', 'n2'), f(`IF(OR(H${r}="",D${r}=""),"",D${r}-H${r})`, n && RL !== '' ? RL - bot : '', 'n2'),
      f(`IF(L${r}="","",L${r}*I${r})`, Ni === '' ? '' : Ni * thick, 'n2'),
      f(`IF(F${r}=0,"Tidak ada ore",IF(H${r}>=E${r},"TERBUKA di EOH – tebal minimum","Tertutup (Ni < cut-off di EOH)"))`, status),
      f(`IF(AND(ISNUMBER(B${r}),ISNUMBER(C${r})),1,0)`, valid, 'n0'), f(`IF(S${r}=1,B${r},0)`, valid ? X : 0, 'n2'), f(`IF(S${r}=1,C${r},0)`, valid ? Y : 0, 'n2'),
      f(`IF(AND(S${r}=1,F${r}>0),1,0)`, vore, 'n0'), f(`IF(V${r}=1,I${r},0)`, vore ? thick : 0, 'n2'), f(`IF(V${r}=1,L${r},0)`, vore ? Ni : 0, 'n3'), f(`IF(V${r}=1,M${r},0)`, vore ? Fe : 0, 'n2'), f(`IF(V${r}=1,N${r},0)`, vore ? Mg : 0, 'n2')]);
    data.push({ hole: h, X: valid ? X : 0, Y: valid ? Y : 0, valid, vore, thick, Ni: vore ? Ni : 0, Fe: vore ? Fe : 0, Mg: vore ? Mg : 0, n });
  });
  return { sheet: { name: 'Composite_Ni', rows, widths: [14, 12, 12, 9, 9, 9, 9, 9, 9, 9, 10, 8, 8, 8, 9, 9, 10, 34, 8, 12, 12, 8, 9, 8, 8, 8], freeze: [5, 1], tab: 'FF70AD47' }, data };
}

/* ================= Downhole_Plot (+ data blocks shared with EDA_Scatter) ================= */
export function downholeSheet(cx) {
  const { prim, holes, p, pv, f, HDR, assayValue } = cx; const cut = pv('cutoff');
  const { rows, set } = sheetRows(); set(1, 1, { v: 'Downhole Plot – Ni, Fe, MgO vs Kedalaman', s: 'title' });
  set(2, 1, { v: `Data tiap lubang ditaut ke Assay_Data (kolom A–G; kolom I–M = versi grafik, kosong → #N/A). Grafik per lubang dibatasi ${MAXH} lubang pertama. Garis merah putus-putus = cut-off Ni.`, s: 'note' });
  set(3, 1, { v: 'Garis cut-off', s: 'bold' }); set(3, 2, { v: 'X (Ni)', s: 'bold' }); set(3, 3, { v: 'Kedalaman', s: 'bold' });
  const D0 = 8, last = D0 + prim.length - 1;
  const maxTo = Math.max(10, ...prim.map(a => num(a.to_m) || 0)); const maxD = Math.ceil(maxTo / 10) * 10;
  set(4, 1, 'Titik atas'); set(4, 2, f(p('cutoff'), cut, 'n2')); set(4, 3, { v: 0, s: 'n0' });
  set(5, 1, 'Titik bawah'); set(5, 2, f(p('cutoff'), cut, 'n2')); set(5, 3, f(`MAX(B${D0}:B${Math.max(last, D0)})*2`, maxD, 'n0'));
  const H = ['Hole_ID', 'Kedalaman tengah (m)', 'Ni', 'Fe', 'MgO', 'Al2O3', 'Cr2O3', '', 'Ni (plot)', 'Fe (plot)', 'MgO (plot)', 'Al2O3 (plot)', 'Cr2O3 (plot)'];
  H.forEach((t, i) => t && set(7, i + 1, { v: t, s: 'hdr' }));
  const SRC = ['H', 'I', 'K', 'N', 'O'], SN = ['Ni', 'Fe', 'MgO', 'Al2O3', 'Cr2O3'];
  const blocks = {}; const vals = {}; SN.forEach(k => (vals[k] = []));
  const order = prim.map((a, i) => ({ a, i })).sort((x, y) => x.a.hole_id.localeCompare(y.a.hole_id) || x.a.from_m - y.a.from_m);
  order.forEach(({ a, i }, k) => {
    const r = D0 + k, ar = i + 2; (blocks[a.hole_id] ??= { s: r, e: r }).e = r;
    set(r, 1, f(`Assay_Data!A${ar}`, a.hole_id)); set(r, 2, f(`(Assay_Data!C${ar}+Assay_Data!D${ar})/2`, (num(a.from_m) + num(a.to_m)) / 2, 'n2'));
    SRC.forEach((c, j) => { const v = assayValue(a, SN[j]); vals[SN[j]].push(v);
      set(r, 3 + j, f(`IF(Assay_Data!${c}${ar}="","",Assay_Data!${c}${ar})`, v ?? '', 'n2'));
      set(r, 9 + j, v == null ? NA(`IF(Assay_Data!${c}${ar}="",NA(),Assay_Data!${c}${ar})`) : f(`IF(Assay_Data!${c}${ar}="",NA(),Assay_Data!${c}${ar})`, v, 'n2')); });
  });
  const DP = (c, h) => `Downhole_Plot!$${c}$${blocks[h].s}:$${c}$${blocks[h].e}`;
  const hl = holes.filter(h => blocks[h]); const cap = hl.slice(0, MAXH);
  const mx = k => niceMax(Math.max(0, ...vals[k].filter(v => v != null)));
  const axis = { Ni: { max: mx('Ni') }, Fe: { max: mx('Fe') }, MgO: { max: mx('MgO') } };
  const Y = { reverse: true, min: 0, max: maxD, title: 'Kedalaman (m)' };
  const charts = []; const SERC = { Ni: 'I', Fe: 'J', MgO: 'K' };
  ['Ni', 'Fe', 'MgO'].forEach(k => charts.push({ type: 'scatter', title: `${k} vs Kedalaman – semua lubang`, x: { title: `${k} (%)`, min: 0, max: axis[k].max, fmt: '0.0' }, y: Y,
    series: cap.map((h, i) => ({ name: h, x: DP(SERC[k], h), y: DP('B', h), line: true, marker: true, msize: 4, color: PAL[i % PAL.length], w: 12700 })) }));
  cap.forEach(h => ['Ni', 'Fe', 'MgO'].forEach((k, i) => {
    const s = [{ name: `${k} ${h}`, x: DP(SERC[k], h), y: DP('B', h), line: true, marker: true, msize: 5, color: PAL[i] }];
    if (k === 'Ni') s.push({ name: 'Cut-off Ni', x: 'Downhole_Plot!$B$4:$B$5', y: 'Downhole_Plot!$C$4:$C$5', line: true, marker: false, color: 'C00000', dash: 'dash' });
    charts.push({ type: 'scatter', title: `${h} – ${k}`, x: { title: `${k} (%)`, min: 0, max: axis[k].max, fmt: '0.0' }, y: Y, series: s });
  }));
  chartGrid(charts.length, 2, 14).forEach((at, i) => (charts[i].at = at));
  return { sheet: { name: 'Downhole_Plot', rows, widths: [12, 12, 8, 8, 8, 8, 8, 3, 9, 9, 9, 9, 9, 3], freeze: [7, 0], tab: 'FF2E75B6', charts }, blocks, vals, order, cap, DP };
}

/* ================= EDA_Scatter ================= */
export function edaSheet(cx, dpl) {
  const { prim, holes, R, f, HDR, assayValue } = cx; const { blocks, DP, cap } = dpl;
  const { rows, set } = sheetRows(); set(1, 1, { v: 'EDA – Statistik, Korelasi & Scatter', s: 'title' });
  set(2, 1, { v: 'Statistik dasar dan korelasi Pearson dihitung dari Assay_Data (sampel primer). Korelasi per lubang dihitung dari blok data di Downhole_Plot.', s: 'note' });
  const VARS = [['Ni', 'H'], ['Fe', 'I'], ['MgO', 'K'], ['SiO2', 'M'], ['Al2O3', 'N'], ['Cr2O3', 'O'], ['Co', 'J'], ['MnO', 'P'], ['MC', 'U']];
  const arr = Object.fromEntries(VARS.map(([k]) => [k, prim.map(a => assayValue(a, k))]));
  ['n', 'Mean', 'Median', 'Min', 'Max', 'StDev', 'CV'].forEach((t, i) => set(4, 2 + i, { v: t, s: 'hdr' })); set(4, 1, { v: 'Parameter', s: 'hdr' });
  VARS.forEach(([k, c], i) => { const r = 5 + i, v = arr[k].filter(x => x != null), n = v.length, m = n ? v.reduce((s, x) => s + x, 0) / n : '', s = sd(v);
    set(r, 1, { v: k, s: 'bold' }); set(r, 2, f(`COUNT(${R(c)})`, n, 'n0')); set(r, 3, f(`IFERROR(AVERAGE(${R(c)}),"")`, m, 'n3')); set(r, 4, f(`IFERROR(MEDIAN(${R(c)}),"")`, med(v), 'n3'));
    set(r, 5, f(`IF(B${r}=0,"",MIN(${R(c)}))`, n ? Math.min(...v) : '', 'n3')); set(r, 6, f(`IF(B${r}=0,"",MAX(${R(c)}))`, n ? Math.max(...v) : '', 'n3'));
    set(r, 7, f(`IFERROR(STDEV(${R(c)}),"")`, s, 'n3')); set(r, 8, f(`IFERROR(G${r}/C${r},"")`, s !== '' && m ? s / m : '', 'n3')); });
  const M0 = 5 + VARS.length + 2; set(M0 - 1, 1, { v: 'Matriks korelasi Pearson', s: 'band' });
  set(M0, 1, { v: '', s: 'hdr' }); VARS.forEach(([k], j) => set(M0, 2 + j, { v: k, s: 'hdr' }));
  VARS.forEach(([a, ca], i) => { set(M0 + 1 + i, 1, { v: a, s: 'bold' }); VARS.forEach(([b, cb], j) => set(M0 + 1 + i, 2 + j, f(`IFERROR(CORREL(${R(ca)},${R(cb)}),"")`, i === j ? 1 : pearson(arr[a], arr[b]), 'n2'))); });
  const mat = `B${M0 + 1}:${cl(1 + VARS.length)}${M0 + VARS.length}`;
  const P0 = M0 + VARS.length + 3; set(P0 - 1, 1, { v: 'Korelasi per lubang', s: 'band' });
  ['Hole', 'n', 'r Ni–Fe', 'r Fe–MgO', 'r Al2O3–Cr2O3'].forEach((t, i) => set(P0, 1 + i, { v: t, s: 'hdr' }));
  const pairs = [['Ni', 'Fe', 'H', 'I'], ['Fe', 'MgO', 'I', 'K'], ['Al2O3', 'Cr2O3', 'N', 'O']];
  set(P0 + 1, 1, { v: 'Semua', s: 'bold' }); set(P0 + 1, 2, f(`COUNT(${R('H')})`, arr.Ni.filter(x => x != null).length, 'n0'));
  pairs.forEach(([a, b, ca, cb], j) => set(P0 + 1, 3 + j, f(`IFERROR(CORREL(${R(ca)},${R(cb)}),"")`, pearson(arr[a], arr[b]), 'n2')));
  const hl = holes.filter(h => blocks[h]);
  hl.forEach((h, i) => { const r = P0 + 2 + i, idx = prim.map((a, k) => k).filter(k => prim[k].hole_id === h), g = k => idx.map(x => arr[k][x]);
    set(r, 1, { v: h, s: 'bold' }); set(r, 2, f(`COUNTIF(Downhole_Plot!$A$${blocks[h].s}:$A$${blocks[h].e},A${r})`, idx.length, 'n0'));
    pairs.forEach(([a, b], j) => { const cc = ['C', 'D', 'E', 'F', 'G'], ix = { Ni: 0, Fe: 1, MgO: 2, Al2O3: 3, Cr2O3: 4 };
      set(r, 3 + j, f(`IF(B${r}<3,"",IFERROR(CORREL(${DP(cc[ix[a]], h)},${DP(cc[ix[b]], h)}),""))`, idx.length < 3 ? '' : pearson(g(a), g(b)), 'n2')); }); });
  const T0 = P0 + 3 + hl.length; set(T0 - 1, 1, { v: 'Interpretasi umum (acuan, bukan pengganti penilaian geologis)', s: 'band' });
  ['Ni–Fe: pada laterit nikel, Ni terkonsentrasi di zona transisi; korelasi Ni–Fe biasanya lemah-sedang dan berubah tanda antara limonit dan saprolit.',
    'Fe–MgO: umumnya berkorelasi NEGATIF kuat (Fe naik saat MgO turun karena pelindian Mg) – penanda tingkat laterisasi.',
    'Al2O3–Cr2O3: korelasi positif menunjukkan kontribusi spinel/kromit dan clay pada limonit.',
    'Korelasi per lubang dengan n < 3 tidak dihitung. Satu lubang dengan pola berbeda dari lubang lain patut dicek ulang (kontaminasi, salah urut sampel).'].forEach((t, i) => set(T0 + i, 1, { v: t, s: 'wrap' }));
  const SC = { Ni: 'I', Fe: 'J', MgO: 'K', Al2O3: 'L', Cr2O3: 'M' };
  const mk = (yk, xk) => ({ type: 'scatter', title: `${yk} vs ${xk}`, x: { title: `${xk} (%)`, min: 0, fmt: '0.0' }, y: { title: `${yk} (%)`, min: 0, fmt: '0.0' },
    series: cap.map((h, i) => ({ name: h, x: DP(SC[xk], h), y: DP(SC[yk], h), line: false, marker: true, msize: 5, color: PAL[i % PAL.length] })) });
  const charts = [mk('Ni', 'Fe'), mk('Fe', 'MgO'), mk('Cr2O3', 'Al2O3')]; charts[2].title = 'Al2O3 vs Cr2O3 (Cr2O3 terhadap Al2O3)';
  charts.forEach((c, i) => (c.at = [11, 2 + i * 22, 20, 2 + i * 22 + 21]));
  return { name: 'EDA_Scatter', rows, widths: [16, 10, 10, 10, 10, 10, 10, 10, 10, 10, 3], tab: 'FF2E75B6', charts, scale: [{ sqref: mat, lo: 'FF5B9BD5', hi: 'FFF8696B' }] };
}

/* ================= QAQC_Charts ================= */
export function qaqcChartsSheet(cx) {
  const { qa, p, pv, f } = cx; const { blanks, crms, dups, b0, c0, d0, AZ, CZ, assayValue } = qa; const Q = (c, a, b) => `QAQC!$${c}$${a}:$${c}$${b}`;
  const charts = [], tables = [];                // tables: [(startRow) => void] writers, run once the helper start row is known
  const { rows, set } = sheetRows(); set(1, 1, { v: 'QAQC – Grafik', s: 'title' }); set(2, 1, { v: 'Grafik membaca sheet QAQC langsung; tabel bantu di bawah grafik. Garis putus-putus = batas dari sheet Parameter.', s: 'note' });
  if (blanks.length) {
    const b1 = b0 + blanks.length - 1;
    charts.push({ type: 'line', title: 'Blank – Ni per penyisipan', y: { title: 'Ni (%)', min: 0, fmt: '0.000' }, series: [{ name: 'Ni blank', cat: Q('C', b0, b1), y: Q('D', b0, b1), line: true, marker: true, color: PAL[0] }, { name: 'Batas', cat: Q('C', b0, b1), y: Q('L', b0, b1), line: true, marker: false, color: 'C00000', dash: 'dash' }] });
    const runs = []; blanks.forEach((a, i) => { const k = a.batch_id || ''; if (!runs.length || runs[runs.length - 1].k !== k) runs.push({ k, s: b0 + i, e: b0 + i }); else runs[runs.length - 1].e = b0 + i; });
    charts.push({ type: 'line', title: 'Blank – Fe per laporan', y: { title: 'Fe (%)', min: 0, fmt: '0.00' }, series: runs.slice(0, 8).map((rn, i) => ({ name: rn.k || 'laporan', cat: Q('C', rn.s, rn.e), y: Q('E', rn.s, rn.e), line: true, marker: true, color: PAL[i % PAL.length] })) });
  }
  if (dups.length) {
    const n = dups.length, d1 = d0 + n - 1, TY = ['RD', 'CD', 'PD'];
    const ori = dups.map(a => qa.byNo.get(a.duplicate_of_sample_no)), niO = ori.map(o => (o ? assayValue(o, 'Ni') : null)), niD = dups.map(a => assayValue(a, 'Ni'));
    const maxV = niceMax(Math.max(0.1, ...niO.filter(v => v != null), ...niD.filter(v => v != null)));
    tables.push(s0 => {
      set(s0, 1, { v: 'Tabel bantu – Duplikat Ni (original vs duplikat per tipe)', s: 'band' }); ['Ni original', 'RD', 'CD', 'PD', '', 'Garis x', '1:1', '+20%', '−20%'].forEach((t, i) => t && set(s0 + 1, 1 + i, { v: t, s: 'hdr' }));
      dups.forEach((a, i) => { const r = s0 + 2 + i, qr = d0 + i, t = a.duplicate_type || 'RD';
        set(r, 1, f(`QAQC!E${qr}`, niO[i] ?? '', 'n3'));
        TY.forEach((ty, j) => set(r, 2 + j, t === ty && niD[i] != null ? f(`IF(QAQC!$B${qr}="${ty}",QAQC!F${qr},NA())`, niD[i], 'n3') : NA(`IF(QAQC!$B${qr}="${ty}",QAQC!F${qr},NA())`))); });
      [0, 1].forEach(k => { const r = s0 + 2 + k, x = k ? maxV : 0; set(r, 6, { v: x, s: 'n3' }); set(r, 7, f(`F${r}`, x, 'n3')); set(r, 8, f(`F${r}*1.2`, x * 1.2, 'n3')); set(r, 9, f(`F${r}*0.8`, x * 0.8, 'n3')); });
      return n + 3; });
    const mkd = s0 => { const a = s0 + 2, b = s0 + 1 + n; return { a, b }; };
    charts.push({ _late: s0 => { const { a, b } = mkd(s0), T = (c, r1, r2) => `QAQC_Charts!$${c}$${r1}:$${c}$${r2}`;
      return { type: 'scatter', title: 'Duplikat Ni – original vs duplikat', x: { title: 'Original (%)', min: 0, max: maxV, fmt: '0.00' }, y: { title: 'Duplikat (%)', min: 0, max: maxV, fmt: '0.00' },
        series: [...TY.map((ty, j) => ({ name: ty, x: T('A', a, b), y: T(cl(1 + j), a, b), line: false, marker: true, msize: 7, color: PAL[j] })),
          { name: '1:1', x: T('F', a, a + 1), y: T('G', a, a + 1), line: true, marker: false, color: '7F7F7F' }, { name: '+20%', x: T('F', a, a + 1), y: T('H', a, a + 1), line: true, marker: false, color: 'A5A5A5', dash: 'dash' }, { name: '−20%', x: T('F', a, a + 1), y: T('I', a, a + 1), line: true, marker: false, color: 'A5A5A5', dash: 'dash' }] }; } });
    // mean ARD per analyte by type
    const AN = [['Ni', 'G'], ['Fe', 'J'], ['MgO', 'M'], ['SiO2', 'P']];
    const ardOf = (an, ty) => { const ix = { Ni: 0, Fe: 1, MgO: 2, SiO2: 3 }[an], v = []; dups.forEach((a, i) => { if ((a.duplicate_type || 'RD') !== ty) return; const o = ori[i], ov = o ? assayValue(o, an) : null, dv = assayValue(a, an); if (ov != null && dv != null && ov + dv > 0) v.push(Math.abs(dv - ov) / ((ov + dv) / 2)); }); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0; };
    tables.push(s0 => { set(s0, 1, { v: 'Tabel bantu – rata-rata ARD per analit', s: 'band' }); ['Analit', ...TY].forEach((t, i) => set(s0 + 1, 1 + i, { v: t, s: 'hdr' }));
      AN.forEach(([an, c], i) => { const r = s0 + 2 + i; set(r, 1, { v: an, s: 'bold' }); TY.forEach((ty, j) => set(r, 2 + j, f(`IFERROR(AVERAGEIFS(${Q(c, d0, d1)},${Q('B', d0, d1)},"${ty}"),0)`, ardOf(an, ty), 'pct'))); }); return 7; });
    charts.push({ _late: s0 => ({ type: 'bar', title: 'Rata-rata ARD per analit & tipe duplikat', y: { title: 'ARD', min: 0, fmt: '0%' },
      series: TY.map((ty, j) => ({ name: ty, cat: `QAQC_Charts!$A$${s0 + 2}:$A$${s0 + 5}`, y: `QAQC_Charts!$${cl(1 + j)}$${s0 + 2}:$${cl(1 + j)}$${s0 + 5}`, color: PAL[j] })) }) });
  }
  if (crms.length) {
    const c1 = c0 + crms.length - 1, A6 = AZ.slice(0, 6), nC = crms.length;
    const meas = A6.map(an => crms.map(a => assayValue(a, an)));
    tables.push(s0 => {
      set(s0, 1, { v: 'Tabel bantu – CRM (sertifikat ± 2SD / 3SD dan Z-score)', s: 'band' }); set(s0 + 1, 1, { v: 'Sample_ID', s: 'hdr' });
      A6.forEach((an, k) => ['cert', '+2SD', '−2SD', '+3SD', '−3SD'].forEach((t, j) => set(s0 + 1, 2 + k * 5 + j, { v: `${an} ${t}`, s: 'hdr' })));
      A6.forEach((an, k) => set(s0 + 1, 32 + k, { v: `Z ${an}`, s: 'hdr' })); ['+2', '−2', '+3', '−3'].forEach((t, j) => set(s0 + 1, 38 + j, { v: t, s: 'hdr' }));
      crms.forEach((a, i) => { const r = s0 + 2 + i, qr = c0 + i; set(r, 1, f(`QAQC!C${qr}`, a.sample_no));
        A6.forEach((an, k) => { const c = CZ[an], b = 2 + k * 5, has = c.certV != null, g = (m, v) => (has ? f(`IF(${c.cert}="",NA(),${c.cert}${m})`, v, 'n3') : NA(`NA()`));
          [['', c.certV], ['+2*' + c.sd, has ? c.certV + 2 * c.sdV : 0], ['-2*' + c.sd, has ? c.certV - 2 * c.sdV : 0], ['+3*' + c.sd, has ? c.certV + 3 * c.sdV : 0], ['-3*' + c.sd, has ? c.certV - 3 * c.sdV : 0]].forEach(([m, v], j) => set(r, b + j, g(m, v))); });
        A6.forEach((an, k) => { const c = CZ[an], x = meas[k][i], ok = c.certV != null && x != null && c.sdV >= pv('res'), z = ok ? (x - c.certV) / c.sdV : null, zc = `QAQC!${cl(10 + k)}${qr}`;
          set(r, 32 + k, z == null ? NA(`IF(ISNUMBER(${zc}),${zc},NA())`) : f(`IF(ISNUMBER(${zc}),${zc},NA())`, z, 'n2')); });
        [2, -2, 3, -3].forEach((v, j) => set(r, 38 + j, { v, s: 'n0' })); });
      return nC + 3; });
    A6.forEach((an, k) => { const c = CZ[an]; if (c.certV == null) return; charts.push({ _late: s0 => { const a = s0 + 2, b = s0 + 1 + nC, T = (col, r1, r2) => `QAQC_Charts!$${col}$${r1}:$${col}$${r2}`, b5 = 1 + k * 5, cat = T('A', a, b);
      return { type: 'line', title: `CRM ${an} – control chart`, y: { title: `${an} (%)`, fmt: '0.00' }, series: [{ name: 'Terukur', cat, y: Q(cl(3 + k), c0, c1), line: true, marker: true, color: PAL[0] }, { name: 'Sertifikat', cat, y: T(cl(b5), a, b), line: true, marker: false, color: '70AD47' },
        { name: '±2SD', cat, y: T(cl(b5 + 1), a, b), line: true, marker: false, color: 'FFC000', dash: 'dash' }, { name: '−2SD', cat, y: T(cl(b5 + 2), a, b), line: true, marker: false, color: 'FFC000', dash: 'dash' },
        { name: '±3SD', cat, y: T(cl(b5 + 3), a, b), line: true, marker: false, color: 'C00000', dash: 'dash' }, { name: '−3SD', cat, y: T(cl(b5 + 4), a, b), line: true, marker: false, color: 'C00000', dash: 'dash' }] }; } }); });
    charts.push({ _late: s0 => { const a = s0 + 2, b = s0 + 1 + nC, T = (col) => `QAQC_Charts!$${col}$${a}:$${col}$${b}`;
      return { type: 'line', title: 'CRM – Z-score semua analit', y: { title: 'Z', fmt: '0.0' }, series: [...A6.map((an, k) => ({ name: an, cat: T('A'), y: T(cl(31 + k)), line: true, marker: true, color: PAL[k] })),
        ...[['+2', 37, 'FFC000'], ['−2', 38, 'FFC000'], ['+3', 39, 'C00000'], ['−3', 40, 'C00000']].map(([nm, ci, co]) => ({ name: nm, cat: T('A'), y: T(cl(ci)), line: true, marker: false, color: co, dash: 'dash' }))] }; } });
  }
  // helper tables start below the chart grid; _late charts get the start row of their own table
  const rowsOfCharts = Math.ceil(charts.length / 3) * 21 + 3, S = rowsOfCharts + 3;
  let cur = S; const starts = []; tables.forEach(t => { starts.push(cur); cur += t(cur) + 1; });
  // map each _late chart to the table it needs: dup scatter + ARD bar -> tables 0,1 (when dups); CRM -> last table
  const need = []; let ti = 0; if (dups.length) { need.push(starts[ti++], starts[ti++]); } const crmStart = crms.length ? starts[ti] : null;
  let ni = 0; charts.forEach(ch => { if (!ch._late) return; const s0 = ni < (dups.length ? 2 : 0) ? need[ni++] : crmStart; Object.assign(ch, ch._late(s0)); delete ch._late; });
  chartGrid(charts.length, 2, 0).forEach((at, i) => (charts[i].at = at));
  return { name: 'QAQC_Charts', rows, widths: [14], tab: 'FFC00000', charts };
}

/* ================= IDW maps ================= */
export function mapSheet(cx, comp, def) {
  const { p, pv, f, cfirst, clast } = cx; const FL = def.flag === 'S' ? 'idw_fs' : 'idw_fv', CT = 'idw_x', CU = 'idw_y', VAL = { I: 'idw_t', X: 'idw_ni', Y: 'idw_fe', Z: 'idw_mg' }[def.val];
  const { rows, set } = sheetRows(); const NX = 30, NY = 30, g0 = 9, g1 = g0 + NY - 1, c0 = 3, c1 = c0 + NX - 1, gr = `C${g0}:${cl(c1 - 1)}${g1}`;
  const pts = comp.filter(d => (def.flag === 'S' ? d.valid : d.vore)), val = d => (def.val === 'I' ? d.thick : def.val === 'X' ? d.Ni : def.val === 'Y' ? d.Fe : d.Mg);
  const pw = pv('idw_p'), rad = pv('idw_r'), mn = pv('idw_min'), bf = pv('idw_buf'), nv = pts.length;
  const xmin = nv ? Math.min(...pts.map(d => d.X)) - bf : '', xmax = nv ? Math.max(...pts.map(d => d.X)) + bf : '', ymax = nv ? Math.max(...pts.map(d => d.Y)) + bf : '', ymin = nv ? Math.min(...pts.map(d => d.Y)) - bf : '';
  const dX = nv ? Math.max(1, (xmax - xmin) / (NX - 1)) : '', dY = nv ? Math.max(1, (ymax - ymin) / (NY - 1)) : '';
  set(1, 1, { v: def.title, s: 'title' }); set(2, 1, { v: `Interpolasi IDW 30×30 dari Composite_Ni (pangkat, radius, min titik, buffer: sheet Parameter). Peta bersifat indikatif – bukan estimasi sumberdaya.`, s: 'note' });
  set(3, 1, { v: 'X min grid (m)', s: 'bold' }); set(3, 2, f(`IF(H3=0,"",_xlfn.MINIFS(${CT},${FL},1)-${p('idw_buf')})`, xmin, 'n2'));
  set(3, 4, { v: 'dX (m)', s: 'bold' }); set(3, 5, f(`IF(H3=0,"",MAX(1,(_xlfn.MAXIFS(${CT},${FL},1)+${p('idw_buf')}-B3)/${NX - 1}))`, dX, 'n2'));
  set(3, 7, { v: 'Titik valid', s: 'bold' }); set(3, 8, f(`SUM(${FL})`, nv, 'n0'));
  set(4, 1, { v: 'Y max grid (m)', s: 'bold' }); set(4, 2, f(`IF(H3=0,"",_xlfn.MAXIFS(${CU},${FL},1)+${p('idw_buf')})`, ymax, 'n2'));
  set(4, 4, { v: 'dY (m)', s: 'bold' }); set(4, 5, f(`IF(H3=0,"",MAX(1,(B4-(_xlfn.MINIFS(${CU},${FL},1)-${p('idw_buf')}))/${NY - 1}))`, dY, 'n2'));
  set(4, 7, { v: 'Satuan', s: 'bold' }); set(4, 8, def.unit);
  set(5, 1, { v: '', s: 'note' }); set(5, 1, f(`IF(H3=0,"Tidak ada titik valid (koordinat collar / ore belum ada)",IF(H3<4,"Titik valid < 4: interpolasi tidak andal",""))`, nv === 0 ? 'Tidak ada titik valid (koordinat collar / ore belum ada)' : nv < 4 ? 'Titik valid < 4: interpolasi tidak andal' : '', 'bold'));
  set(8, 1, { v: 'Y \\ X (m)', s: 'hdr' }); set(8, 2, { v: 'Y (m)', s: 'hdr' });
  for (let j = 0; j < NX; j++) set(8, c0 + j, f(`IF($B$3="","",$B$3+${j}*$E$3)`, nv ? xmin + j * dX : '', 'n0'));
  const r2 = `${p('idw_r')}^2`, vals = [];
  for (let i = 0; i < NY; i++) {
    const r = g0 + i, Y = nv ? ymax - i * dY : ''; set(r, 2, f(`IF($B$4="","",$B$4-${i}*$E$4)`, Y, 'n0'));
    for (let j = 0; j < NX; j++) {
      const X = nv ? xmin + j * dX : '', xc = `${cl(c0 + j - 1)}$8`, yc = `$B${r}`, d2 = `((${CT}-${xc})^2+(${CU}-${yc})^2)`, W = `(${d2}+1)^(${p('idw_p')}/2)`;
      let v = ''; if (nv) { let sn = 0, sw = 0, cnt = 0; for (const d of pts) { const dd = (d.X - X) ** 2 + (d.Y - Y) ** 2; if (dd <= rad * rad) { const w = 1 / Math.pow(dd + 1, pw / 2); sn += w * val(d); sw += w; cnt++; } } if (cnt >= mn && sw > 0) v = sn / sw; }
      vals.push(v);
      set(r, c0 + j, f(`IFERROR(IF(SUMPRODUCT(${FL}*(${d2}<=${r2}))<${p('idw_min')},"",SUMPRODUCT(${FL}*(${d2}<=${r2})*${VAL}/${W})/SUMPRODUCT(${FL}*(${d2}<=${r2})/${W})),"")`, v, def.fmt || 'n2'));
    }
  }
  const nums = vals.filter(v => v !== ''); const st = nums.length ? { mn: Math.min(...nums), me: nums.reduce((s, x) => s + x, 0) / nums.length, mx: Math.max(...nums) } : { mn: '', me: '', mx: '' };
  set(40, 1, { v: 'Statistik grid', s: 'band' }); set(40, 2, { s: 'band' });
  [['Min', `IFERROR(IF(COUNT(${gr})=0,"",MIN(${gr})),"")`, st.mn], ['Rata-rata', `IFERROR(IF(COUNT(${gr})=0,"",AVERAGE(${gr})),"")`, st.me], ['Maks', `IFERROR(IF(COUNT(${gr})=0,"",MAX(${gr})),"")`, st.mx], ['Node terisi', `COUNT(${gr})`, nums.length]]
    .forEach(([t, fm, v], i) => { set(41 + i, 1, { v: t, s: 'bold' }); set(41 + i, 2, f(fm, v, i === 3 ? 'n0' : (def.fmt || 'n2'))); });
  set(46, 2, { v: 'Titik data (dari Composite_Ni)', s: 'band' });
  ['Hole', 'X (m)', 'Y (m)', def.col].forEach((t, i) => set(47, 2 + i, { v: t, s: 'hdr' }));
  comp.forEach((d, k) => { const r = 48 + k, cr0 = cfirst + k, ok = def.flag === 'S' ? d.valid : d.vore;
    set(r, 2, f(`Composite_Ni!A${cr0}`, d.hole));
    set(r, 3, ok ? f(`IF(Composite_Ni!${def.flag}${cr0}=1,Composite_Ni!T${cr0},NA())`, d.X, 'n2') : NA(`IF(Composite_Ni!${def.flag}${cr0}=1,Composite_Ni!T${cr0},NA())`));
    set(r, 4, ok ? f(`IF(Composite_Ni!${def.flag}${cr0}=1,Composite_Ni!U${cr0},NA())`, d.Y, 'n2') : NA(`IF(Composite_Ni!${def.flag}${cr0}=1,Composite_Ni!U${cr0},NA())`));
    set(r, 5, ok ? f(`IF(Composite_Ni!${def.flag}${cr0}=1,Composite_Ni!${def.val}${cr0},NA())`, val(d), def.fmt || 'n2') : NA(`IF(Composite_Ni!${def.flag}${cr0}=1,Composite_Ni!${def.val}${cr0},NA())`)); });
  const e = 47 + Math.max(comp.length, 1), M = (c) => `${def.sheet}!$${c}$48:$${c}$${e}`;
  const charts = comp.length ? [{ type: 'bubble', title: `${def.col} per lubang (ukuran gelembung = nilai)`, legend: false, scale: 60, x: { title: 'X (m)', fmt: '0' }, y: { title: 'Y (m)', fmt: '0' }, series: [{ name: def.col, x: M('C'), y: M('D'), size: M('E'), color: def.color }], at: [6, 39, 18, 62] }] : [];
  return { name: def.sheet, rows, widths: [16, 12, ...Array(NX).fill(9)], tab: 'FF70AD47', scale: [{ sqref: gr, lo: def.lo, hi: def.hi }], charts };
}

// workbook-level names so the 900 IDW formulas per map stay short
export const idwNames = (cfirst, clast) => Object.entries({ idw_x: 'T', idw_y: 'U', idw_fs: 'S', idw_fv: 'V', idw_t: 'I', idw_ni: 'X', idw_fe: 'Y', idw_mg: 'Z' }).map(([name, c]) => ({ name, ref: `Composite_Ni!$${c}$${cfirst}:$${c}$${clast}` }));
