"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { core, type Info } from "@/lib/boot";
import { PARAM_SECTIONS, getParam, setParam } from "@/lib/core/lab/params.js";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardTitle } from "./ui/card";
import { ChartCard, Kpi, loadChartJs, useThemeKey, type ChartSpec } from "./chart-card";
import { NeedsOnline } from "./dashboard-view";
import { useToast } from "./toast";
import { useConfirm } from "./confirm";

const STALE = 2 * 60 * 1000;
let cache: { site: string; data: any; at: number } | null = null;
const nf = (v: any, d = 0) => (v == null || Number.isNaN(v) ? "-" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const SEV: Record<string, [string, string]> = { critical: ["✖", "Critical"], warning: ["⚠", "Warning"], info: ["ℹ", "Info"], fail: ["✖", "Fail"], warn: ["⚠", "Warn"], pass: ["✓", "Pass"], "n/a": ["–", "n/a"] };
const Pill = ({ s }: { s: string }) => (
  <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold",
    s === "critical" || s === "fail" ? "border-[var(--danger-border)] bg-[var(--danger-bg)] text-danger" : s === "warning" || s === "warn" ? "border-[var(--warning-border)] bg-[var(--warning-bg)] text-warning" : s === "pass" ? "border-[var(--success-border)] bg-[var(--success-bg)] text-success" : "bg-muted text-muted-foreground")}>{SEV[s]?.[0]} {SEV[s]?.[1]}</span>
);
const Th = ({ children, onClick, active }: any) => <th onClick={onClick} className={cn("whitespace-nowrap border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground", onClick && "cursor-pointer select-none hover:text-foreground")}>{children}{active}</th>;
const Td = ({ children, className }: any) => <td className={cn("border-b px-3 py-2 align-top", className)}>{children}</td>;
function save(u8: BlobPart, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([u8], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
const day = () => new Date().toLocaleDateString("sv-SE");

export function QcView({ info }: { info: Info }) {
  const [st, setSt] = useState<{ data: any; err: string; loading: boolean }>({ data: null, err: "", loading: true });
  const [sub, setSub] = useState("geo"); const tk = useThemeKey();
  const [Q, setQ] = useState<any>(null);
  useEffect(() => { import("@/lib/core/qc/calc.js").then(setQ); }, []);
  async function load(force = false) {
    if (!navigator.onLine) return setSt({ data: null, err: "offline", loading: false });
    if (info.guest) return setSt({ data: null, err: "guest", loading: false });
    if (!force && cache && cache.site === info.site && Date.now() - cache.at < STALE) return setSt({ data: cache.data, err: "", loading: false });
    setSt(s => ({ ...s, loading: true, err: "" }));
    try {
      const { S } = await core(); const sb = S.getClient(); const { data: sess } = await sb.auth.getSession();
      if (!sess?.session) throw new Error("Your login session has expired. Sign out, then sign in again while online.");
      const { loadQcData } = await import("@/lib/core/qc/data.js"); const data = await loadQcData(sb, info.site);
      cache = { site: info.site, data, at: Date.now() }; setSt({ data, err: "", loading: false });
    } catch (e: any) { setSt({ data: null, err: e.message || String(e), loading: false }); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [info.site, info.guest]);
  const d = st.data;
  const T = useMemo(() => (d && Q ? Q.thresholds(d.setting) : null), [d, Q]);
  const R = useMemo(() => (d && Q && T ? Q.analyze(d, T) : null), [d, Q, T]);

  if (st.err) return <NeedsOnline what="Data QC" err={st.err} retry={() => load(true)} />;
  if (!d || !R) return <div className="text-sm text-muted-foreground" aria-busy>Loading Data QC…</div>;
  const s = R.summary, age = cache ? Math.round((Date.now() - cache.at) / 60000) : 0;
  const crmNi = R.crms.filter((c: any) => c.analyte === "Ni" && c.status !== "n/a"), dupN = R.dups.filter((x: any) => x.ard != null);

  async function issuesXlsx() {
    const { buildXlsx }: any = await import("@/lib/core/xlsx-lite.js");
    const S2 = (k: string) => SEV[k][1];
    save(buildXlsx([
      { name: "Issues", header: ["Severity", "Category", "Hole", "Reference", "Issue"], rows: R.issues.map((i: any) => [S2(i.sev), i.cat, i.hole, i.ref, i.msg]) },
      { name: "Batches", header: ["Lab report", "Reported", "Samples", "Blank", "CRM", "Dup", "QC rate %", "Fails", "Warns", "Status", "Missing QC"], rows: R.batches.map((b: any) => [b.batch, b.reported, b.primary, b.blank, b.crm, b.dup, b.qcRate, b.fails, b.warns, S2(b.status), b.missing.join(", ")]) },
      { name: "Blank", header: ["Lab report", "Sample", "Ni %", "Limit %", "Status"], rows: R.blanks.map((b: any) => [b.batch, b.sample_no, b.ni, b.limit, S2(b.status)]) },
      { name: "CRM", header: ["Lab report", "Sample", "Analyte", "Measured", "Certified", "SD", "Z", "Status"], rows: R.crms.map((c: any) => [c.batch, c.sample_no, c.analyte, c.measured, c.certified, c.sd, c.z, S2(c.status)]) },
      { name: "Duplicate", header: ["Lab report", "Duplicate", "Original", "Type", "Ni orig", "Ni dup", "ARD", "Limit", "Status"], rows: R.dups.map((x: any) => [x.batch, x.sample_no, x.original, x.type, x.orig_ni, x.dup_ni, x.ard, x.max, S2(x.status)]) },
    ]), `data_qc_${info.site}_${day()}.xlsx`);
  }
  async function labXlsx() {
    try { const { buildLabWorkbook }: any = await import("@/lib/core/lab/workbook.js");
      save(buildLabWorkbook({ site: info.site, generated: day(), collars: d.collar, assays: d.assay, crm: d.crm, setting: d.setting, utm: d.utm }), `lab_analysis_${info.site}_${day()}.xlsx`);
    } catch (e: any) { console.error(e); alert("Workbook failed: " + (e.message || e)); }
  }

  return (
    <div className="enter flex flex-col gap-5" id="qc">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-1 text-xs font-medium text-success">Live from {info.site}{age ? ` · ${age} min ago` : ""}</span>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" id="q-lab" onClick={labXlsx}><Download />Lab analysis (Excel)</Button>
          <Button size="sm" variant="outline" id="q-xls" onClick={issuesXlsx}><Download />Issues (Excel)</Button>
          <Button size="sm" variant="outline" id="q-refresh" onClick={() => load(true)}><RefreshCw />Refresh</Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" id="q-kpis">
        <Kpi label="Critical issues" value={nf(s.critical)} sub="must be fixed or explained" tone={s.critical ? "bad" : undefined} />
        <Kpi label="Warnings" value={nf(s.warning)} sub="check, may be acceptable" />
        <Kpi label="Lab batches" value={nf(s.batches)} sub={`${R.batches.filter((b: any) => b.status === "fail").length} failed, ${R.batches.filter((b: any) => b.status === "warn").length} with warnings`} />
        <Kpi label="QAQC checks failed" value={s.qaqcTotal ? nf((s.qaqcFail / s.qaqcTotal) * 100, 1) + "%" : "-"} sub={`${nf(s.qaqcFail)} of ${nf(s.qaqcTotal)} (blank, CRM, duplicate)`} />
        <Kpi label="CRM Ni Z (mean)" value={crmNi.length ? nf(crmNi.reduce((a: number, c: any) => a + c.z, 0) / crmNi.length, 2) : "-"} sub={`${crmNi.length} CRM results; |Z| ≤ ${T.crm_z_warn} is good`} />
        <Kpi label="Duplicates within limit" value={dupN.length ? nf((dupN.filter((x: any) => x.status === "pass").length / dupN.length) * 100, 0) + "%" : "-"} sub={`${dupN.length} pairs, Ni ARD`} />
      </div>
      <div id="q-sub" className="inline-flex w-fit flex-wrap overflow-hidden rounded-md border">
        {[["geo", "QC & Survey"], ["qaqc", "QAQC Geochemistry"], ["lab", "Lab Analysis"], ["thr", "Thresholds"]].map(([k, l]) => <button key={k} data-s={k} onClick={() => setSub(k)} className={cn("h-9 px-3 text-sm", k === sub ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}>{l}</button>)}
      </div>
      {sub === "geo" && <Geo R={R} />}
      {sub === "qaqc" && <Qaqc R={R} T={T} d={d} tk={tk} />}
      {sub === "lab" && <Lab d={d} site={info.site} tk={tk} info={info} T={T} reload={() => load(true)} />}
      {sub === "thr" && <Thr T={T} d={d} />}
    </div>
  );
}

function Geo({ R }: { R: any }) {
  const [sev, setSev] = useState(""); const [cat, setCat] = useState(""); const [q, setQ] = useState(""); const [sort, setSort] = useState<[string, 1 | -1]>(["sev", 1]);
  const cats = [...new Set(R.issues.map((i: any) => i.cat))].sort() as string[];
  const rank: any = { critical: 0, warning: 1, info: 2 };
  const rows = R.issues.filter((i: any) => (!sev || i.sev === sev) && (!cat || i.cat === cat) && (!q || `${i.hole} ${i.ref} ${i.msg}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a: any, b: any) => { const [k, dir] = sort; const va = k === "sev" ? rank[a.sev] : String(a[k]), vb = k === "sev" ? rank[b.sev] : String(b[k]); return (va > vb ? 1 : va < vb ? -1 : 0) * dir; });
  const th = (k: string, l: string) => <Th key={k} onClick={() => setSort(s => [k, s[0] === k ? (-s[1] as 1 | -1) : 1])} active={sort[0] === k ? (sort[1] > 0 ? " ▲" : " ▼") : ""}>{l}</Th>;
  return (
    <Card id="q-issues"><CardTitle>Issues</CardTitle>
      <p className="text-sm text-muted-foreground">Collar, survey, sample register and assay interval checks, plus every failed QAQC result. {nf(rows.length)} of {nf(R.issues.length)} shown.</p>
      <div className="flex flex-wrap gap-2">
        <select id="f-sev" value={sev} onChange={e => setSev(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm"><option value="">All severities</option>{["critical", "warning", "info"].map(k => <option key={k} value={k}>{SEV[k][1]}</option>)}</select>
        <select id="f-cat" value={cat} onChange={e => setCat(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm"><option value="">All categories</option>{cats.map(c => <option key={c}>{c}</option>)}</select>
        <Input id="f-q" type="search" placeholder="Search hole, sample, message" className="h-9 max-w-xs" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {rows.length ? <div className="max-h-[60vh] overflow-auto rounded-md border"><table className="w-full text-sm"><thead className="sticky top-0 bg-muted"><tr>{th("sev", "Severity")}{th("cat", "Category")}{th("hole", "Hole")}{th("ref", "Reference")}{th("msg", "Issue")}</tr></thead>
        <tbody>{rows.slice(0, 500).map((i: any, n: number) => <tr key={n} data-issue><Td><Pill s={i.sev} /></Td><Td>{i.cat}</Td><Td>{i.hole}</Td><Td>{i.ref}</Td><Td>{i.msg}</Td></tr>)}</tbody></table>
        {rows.length > 500 && <p className="p-3 text-xs text-muted-foreground">First 500 shown. Narrow the filter or download the Excel file for all {nf(rows.length)}.</p>}</div>
        : <div className="grid h-24 place-items-center text-sm text-muted-foreground">No issues for this filter ✓</div>}
    </Card>
  );
}

function Qaqc({ R, T, d, tk }: { R: any; T: any; d: any; tk: number }) {
  const [an, setAn] = useState("Ni"); const [COLOR, setCOLOR] = useState<any>(null); const [BI, setBI] = useState<any>(null);
  useEffect(() => { loadChartJs().then(() => import("@/lib/core/dash/ui.js")).then(u => { u.syncChartColors(); setBI(u); setCOLOR({ ...u.COLOR }); }); }, [tk]);
  const hasQc = R.blanks.length + R.crms.length + R.dups.length > 0;
  if (!hasQc) return <Card><div className="grid min-h-24 place-items-center text-center text-sm text-muted-foreground">No lab QC data yet. Import a lab Report of Analysis (RoA Lab tab) to see blank, CRM and duplicate results.{d.crm.length ? "" : " The CRM certificate table is empty (run migration 0014 on this site)."}</div></Card>;
  if (!BI || !COLOR) return null;
  const { baseOptions } = BI; const Chart = (window as any).Chart;
  const analytes = [...new Set(R.crms.filter((c: any) => c.status !== "n/a").map((c: any) => c.analyte))] as string[];
  const cur = analytes.includes(an) ? an : analytes.includes("Ni") ? "Ni" : analytes[0] || "Ni";
  const crmRows = R.crms.filter((c: any) => c.analyte === cur);
  const dd = R.dups.filter((x: any) => x.ard != null);
  const skipped = [...new Set(R.crms.filter((c: any) => c.status === "n/a").map((c: any) => c.analyte))] as string[];
  const order = ["BRK", "RSAP", "SAP", "CEK", "LIM"], cl = order.map(k => R.classes[k] || 0);
  const bar = { maxBarThickness: 18, borderRadius: { topLeft: 3, topRight: 3 }, borderSkipped: "bottom" };

  const blank: ChartSpec = { id: "blank", title: "Blank: Ni", sub: `Limit ${T.blank_ni_max}% Ni. A blank above the limit means carry-over or contamination in preparation.`,
    head: ["Batch", "Sample", "Ni %", "Status"], rows: R.blanks.map((b: any) => [b.batch, b.sample_no, b.ni, SEV[b.status][1]]),
    make: cv => new Chart(cv, { type: "bar", data: { labels: R.blanks.map((b: any) => `${b.batch.slice(-5)} ${b.sample_no}`), datasets: [
      { label: "Ni %", data: R.blanks.map((b: any) => b.ni), backgroundColor: R.blanks.map((b: any) => (b.status === "fail" ? COLOR.fail : COLOR.ok)), ...bar },
      { type: "line", label: `Limit ${T.blank_ni_max}`, data: R.blanks.map(() => T.blank_ni_max), borderColor: COLOR.fail, borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5 }] }, options: baseOptions({ legend: true, yTitle: "Ni %" }) }) };
  const dup: ChartSpec = { id: "dup", title: "Duplicates: Ni ARD", sub: `ARD = |dup - orig| / mean. Limits: PD ${T.dup_ard_ni_max.PD * 100}%, CD ${T.dup_ard_ni_max.CD * 100}%, RD ${T.dup_ard_ni_max.RD * 100}%.`,
    head: ["Batch", "Duplicate", "Type", "Orig Ni", "Dup Ni", "ARD %", "Limit %", "Status"], rows: R.dups.map((x: any) => [x.batch, x.sample_no, x.type, x.orig_ni ?? "", x.dup_ni ?? "", x.ard == null ? "" : +(x.ard * 100).toFixed(1), x.max * 100, SEV[x.status][1] + (x.note ? " (" + x.note + ")" : "")]),
    make: cv => new Chart(cv, { type: "bar", data: { labels: dd.map((x: any) => x.sample_no), datasets: [
      { label: "ARD %", data: dd.map((x: any) => +(x.ard * 100).toFixed(2)), backgroundColor: dd.map((x: any) => (x.status === "fail" ? COLOR.fail : COLOR.ok)), ...bar, maxBarThickness: 14 },
      { type: "line", label: "Limit", data: dd.map((x: any) => x.max * 100), borderColor: COLOR.fail, borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5, stepped: true }] },
      options: { ...baseOptions({ legend: true, yTitle: "ARD %" }), scales: { x: { ticks: { display: false }, grid: { display: false } }, y: baseOptions({ yTitle: "ARD %" }).scales.y } } }) };
  const crm: ChartSpec = { id: "crm", title: `CRM Z-score: ${cur}`, sub: `Z = (measured - certified) / SD. Warn beyond ±${T.crm_z_warn}, fail beyond ±${T.crm_z_fail}. Persistent same-sign Z means lab bias.`,
    head: ["Batch", "CRM sample", "Measured", "Certified", "SD", "Z", "Status"], rows: crmRows.map((c: any) => [c.batch, c.sample_no, c.measured, c.certified, c.sd, c.z, SEV[c.status][1]]),
    make: cv => new Chart(cv, { type: "bar", data: { labels: crmRows.map((c: any) => `${c.batch.slice(-5)} ${c.sample_no.replace(/OREAS\s*/i, "")}`), datasets: [
      { label: "Z", data: crmRows.map((c: any) => c.z), backgroundColor: crmRows.map((c: any) => (c.status === "fail" ? COLOR.fail : c.status === "warn" ? COLOR.warn : COLOR.ok)), maxBarThickness: 18 },
      ...[T.crm_z_warn, -T.crm_z_warn].map(v => ({ type: "line", label: `±${T.crm_z_warn} warn`, data: crmRows.map(() => v), borderColor: COLOR.warn, borderDash: [4, 4], pointRadius: 0, borderWidth: 1.2 })),
      ...[T.crm_z_fail, -T.crm_z_fail].map(v => ({ type: "line", label: `±${T.crm_z_fail} fail`, data: crmRows.map(() => v), borderColor: COLOR.fail, borderDash: [6, 3], pointRadius: 0, borderWidth: 1.2 }))] },
      options: { ...baseOptions({ legend: false, yTitle: "Z" }), scales: { x: { ticks: { maxRotation: 60, font: { size: 10 }, color: COLOR.ink }, grid: { display: false } }, y: { grid: { color: COLOR.grid }, border: { display: false }, title: { display: true, text: "Z" }, suggestedMin: -4, suggestedMax: 4 } } } }) };
  const cls: ChartSpec = { id: "cls", title: "Samples by geochemical class", sub: "BRK/RSAP/SAP/CEK/LIM from Ni, Fe, MgO (rules on the Thresholds tab). A quick sanity check on a new batch.", head: ["Class", "Samples"], rows: order.map((k, i) => [k, cl[i]]),
    make: cv => new Chart(cv, { type: "bar", data: { labels: order, datasets: [{ label: "Samples", data: cl, backgroundColor: COLOR.ok, maxBarThickness: 36, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "bottom" }] }, options: baseOptions({ yTitle: "Samples" }) }) };

  return (
    <div className="flex flex-col gap-4" id="q-grid">
      <Card id="q-batches"><CardTitle>Batch status</CardTitle>
        <p className="text-sm text-muted-foreground">One row per lab report. A batch fails when any blank, CRM or duplicate fails; it warns when a QC type is missing or a result is borderline.</p>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{["Lab report", "Reported", "Samples", "Blank", "CRM", "Dup", "QC rate", "Fails", "Warns", "Status"].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
          <tbody>{R.batches.map((b: any) => <tr key={b.batch}><Td>{b.batch}</Td><Td>{b.reported || "-"}</Td><Td>{b.primary}</Td><Td>{b.blank}</Td><Td>{b.crm}</Td><Td>{b.dup}</Td><Td>{b.qcRate == null ? "-" : b.qcRate + "%"}</Td><Td>{b.fails}</Td><Td>{b.warns}</Td><Td><Pill s={b.status} />{b.missing.length ? <span className="text-xs text-muted-foreground"> no {b.missing.join(", ")}</span> : null}</Td></tr>)}</tbody></table></div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2"><ChartCard spec={blank} themeKey={tk} /><ChartCard spec={dup} themeKey={tk} /></div>
      <div className="flex flex-col gap-2"><label className="flex items-center gap-2 text-sm text-muted-foreground">Analyte
        <select id="q-an" value={cur} onChange={e => setAn(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-foreground">{analytes.map(a => <option key={a}>{a}</option>)}</select></label>
        <ChartCard spec={crm} themeKey={tk} /></div>
      <Card id="q-bias"><CardTitle>Lab bias per batch</CardTitle>
        <p className="text-sm text-muted-foreground">Mean Z per CRM analyte. |mean Z| above 1 is flagged as bias.{skipped.length ? ` ${skipped.join(", ")} is not scored: its certified SD is below the lab's 2-decimal reporting resolution, so Z would only reflect rounding.` : ""}</p>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{["Lab report", "CRM", "Analyte", "n", "Mean Z", "Max |Z|", "Bias"].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
          <tbody>{R.bias.filter((b: any) => !skipped.includes(b.analyte)).map((b: any, i: number) => <tr key={i}><Td>{b.batch}</Td><Td>{b.crm}</Td><Td>{b.analyte}</Td><Td>{b.n}</Td><Td>{b.meanZ}</Td><Td>{b.maxAbsZ}</Td><Td>{b.bias === "none" ? "-" : b.bias === "high" ? "▲ reads high" : "▼ reads low"}</Td></tr>)}</tbody></table></div>
      </Card>
      {R.clashes.length > 0 && <Card><CardTitle>Identical QC results across reports</CardTitle><p className="text-sm text-muted-foreground">A blank or CRM that returns exactly the same values in two reports may have been copied instead of measured. Ask the lab to confirm.</p>
        <ul className="list-disc pl-5 text-sm">{R.clashes.map((c: any, i: number) => <li key={i}><b>{c.type}</b>: {c.rows.map((r: any) => r.batch + " " + r.sample_no).join(" = ")}</li>)}</ul></Card>}
      <ChartCard spec={cls} themeKey={tk} />
    </div>
  );
}

function Lab({ d, site, tk, info, T, reload }: { d: any; site: string; tk: number; info: Info; T: any; reload: () => void }) {
  const [model, setModel] = useState<Map<string, any> | null>(null); const [err, setErr] = useState(""); const [sheet, setSheet] = useState(""); const [shown, setShown] = useState(0);
  const [LV, setLV] = useState<any>(null); const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (async () => {
      try { const [{ buildLabSheets }, lv] = await Promise.all([import("@/lib/core/lab/workbook.js") as any, import("@/lib/core/qc/labview.js") as any]);
        const m = buildLabSheets({ site, generated: day(), collars: d.collar, assays: d.assay, crm: d.crm, setting: d.setting, utm: d.utm });
        setLV(lv); setModel(new Map(m.sheets.map((x: any) => [x.name, x]))); await loadChartJs();
      } catch (e: any) { console.error(e); setErr(e.message || String(e)); }
    })();
  }, [d, site]);
  if (err) return <Card><div className="text-sm text-danger">Lab analysis failed: {err}</div></Card>;
  if (!model || !LV) return <Card><p className="text-sm text-muted-foreground">Building lab analysis…</p></Card>;
  const names = [...model.keys()]; const cur = model.get(sheet) ? sheet : names[0]; const sh = model.get(cur); const charts = sh.charts || [];
  const upto = Math.max(shown, LV.PAGE_CHARTS); const editing = !!info.can_admin && !info.guest && cur === "Parameter";
  return (
    <Card id="q-lab-card"><CardTitle>Lab analysis</CardTitle>
      <p className="text-sm text-muted-foreground">The same {names.length} sheets as the Excel download, computed from your data. Charts, heat-map colours and PASS / FAIL colours match the workbook. {info.can_admin && !info.guest ? "Admins and super admins can change every limit by editing the yellow cells on the Parameter tab; all sheets, charts and the Excel download recalculate." : "Limits come from the Parameter sheet; an admin or super admin can change them."}</p>
      <div id="lab-pick" className="flex flex-wrap gap-1.5">{names.map(n => <button key={n} data-n={n} onClick={() => { setSheet(n); setShown(0); }} className={cn("h-8 rounded-full border px-3 text-sm", n === cur ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}>{n.replace(/_/g, " ")}</button>)}</div>
      {editing && <ParamBar T={T} reload={reload} box={box} />}
      <div id="lab-charts" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{charts.slice(0, upto).map((sp: any, i: number) => <LabChart key={`${cur}${i}${tk}`} sp={sp} model={model} here={sh.name} LV={LV} />)}</div>
      {upto < charts.length && <div><Button size="sm" variant="outline" onClick={() => setShown(upto + LV.PAGE_CHARTS)}>Show more charts ({upto} of {charts.length})</Button></div>}
      {/* the table markup is built by tableHtml() with every cell value escaped */}
      <div id="lab-table" ref={box} className="max-h-[70vh] overflow-auto" dangerouslySetInnerHTML={{ __html: LV.tableHtml(sh, { edit: editing }) }} />
    </Card>
  );
}
function LabChart({ sp, model, here, LV }: any) {
  const ref = useState<HTMLCanvasElement | null>(null);
  return <div className="relative h-80 rounded-lg border p-2"><canvas ref={el => { if (el && !(el as any)._c) { (el as any)._c = true; import("@/lib/core/dash/ui.js").then((u: any) => { u.syncChartColors(); try { (el as any)._chart = new (window as any).Chart(el, LV.chartConfig(sp, model, here)); } catch (e) { console.error(e); } }); } void ref; }} /></div>;
}

function Thr({ T, d }: { T: any; d: any }) {
  const src = d.setting ? 'site setting "qaqc_thresholds" (edited by an admin)' : "built-in defaults (same as migration 0014)";
  const rows = [
    ["Blank: Ni maximum", `${T.blank_ni_max} %`, "About 5 × the detection limit (0.01 %). A blank is clean material; anything above means carry-over or contamination in crushing/pulverising."],
    ["Pulp duplicate (PD): Ni ARD", `${T.dup_ard_ni_max.PD * 100} %`, "ARD = |dup − orig| / mean. Pulp is homogenised, so the tightest limit: it measures the lab analysis alone."],
    ["Coarse duplicate (CD): Ni ARD", `${T.dup_ard_ni_max.CD * 100} %`, "Includes crushing and splitting error, so a looser limit."],
    ["Reject duplicate (RD): Ni ARD", `${T.dup_ard_ni_max.RD * 100} %`, "RD is not defined by the lab yet (reject or repeat); it uses the CD limit until confirmed."],
    ["CRM warn |Z|", `${T.crm_z_warn} SD`, "Z = (measured − certified) / certified SD. Beyond 2 SD happens by chance about 1 time in 20: look, do not reject."],
    ["CRM fail |Z|", `${T.crm_z_fail} SD`, "Beyond 3 SD is rare by chance: the batch result is suspect (bias, mix-up, drift)."],
    ["CRM resolution rule", `SD < ${T.lab_resolution}`, "The lab prints 2 decimals. If a certified SD is smaller than that (Co: 0.0016), Z only measures rounding, so it is not scored."],
    ["Fe₂O₃ vs Fe × 1.4297", `${T.fe2o3_tol_pct} %`, "The two are the same iron in different units; a larger gap points to a data entry or analysis problem."],
    ["Moisture (MC) high", `≥ ${T.mc_max} %`, "Extreme moisture: re-check preparation and weighing."],
    ["Sample sent, no result", `${T.sent_warn_days} / ${T.sent_fail_days} days`, "Warning after 7 days, critical after 14: chase the lab."],
    ["Dip deviation (collar vs survey)", `${T.dip_dev_warn}°`, "A survey dip far from the collar dip often means a wrong sign or a mistyped value."],
    ["GPS accuracy", `${T.gps_warn_m} m`, "Collar position worse than this is flagged."],
    ["Ni cut-off", `${T.cutoff_ni} %`, "Used for ore composites in the lab-analysis workbook. All limits, plus the classification and IDW settings, are edited by admins in Lab Analysis."],
  ];
  return (
    <Card id="q-thr"><CardTitle>Thresholds in use</CardTitle>
      <p className="text-sm text-muted-foreground">Source: {src}. They follow the TPB lab-analysis workbook (Parameter sheet): CRM by Z-score against the certificate, duplicates by relative difference (ARD), blank by an absolute Ni limit.</p>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><Th>Check</Th><Th>Limit</Th><Th>Why</Th></tr></thead><tbody>{rows.map(r => <tr key={r[0]}><Td>{r[0]}</Td><Td><b>{r[1]}</b></Td><Td>{r[2]}</Td></tr>)}</tbody></table></div>
      <p className="text-xs text-muted-foreground"><b>Classification</b> (in order): BRK Ni&lt;{T.brk_ni} and MgO≥{T.brk_mgo} and Fe&lt;{T.brk_fe}; RSAP MgO≥{T.rsap_mgo} and Fe&lt;{T.rsap_fe}; SAP MgO≥{T.sap_mgo}, or Fe&lt;{T.sap_fe} with MgO≥{T.sap_mgo_min}; CEK Fe&lt;{T.sap_fe} and MgO&lt;{T.sap_mgo_min}; otherwise LIM.</p>
      <p className="text-xs text-muted-foreground"><b>CRM certificate values</b> ({d.crm.length} rows in the site table): {[...new Set(d.crm.map((c: any) => c.crm_name))].join(", ") || "none"}. Admins edit them in Supabase (table exp_crm). Never use the OREAS 182 certificate for 182b.</p>
    </Card>
  );
}

const EXTRA_KEYS: any[] = (PARAM_SECTIONS.find((x: any) => x.title.startsWith("E.")) as any).items;
// Editing happens in the yellow cells of the Parameter sheet itself. Four checks that the sheet does not list sit in a small form below.
function ParamBar({ T, reload, box }: { T: any; reload: () => void; box: React.RefObject<HTMLDivElement | null> }) {
  const toast = useToast(); const ask = useConfirm(); const [busy, setBusy] = useState(false);
  const initX = () => Object.fromEntries(EXTRA_KEYS.map(([k]: any) => [k, String(getParam(T, k))]));
  const [x, setX] = useState<Record<string, string>>(initX);
  useEffect(() => { setX(initX()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [T]);
  async function write(value: any, done: string) {
    setBusy(true);
    try {
      const { S } = await core(); const { error } = await S.getClient().from("exp_setting").upsert({ key: "qaqc_thresholds", value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw new Error(error.message);
      toast(done); cache = null; reload();
    } catch (e: any) { toast(e.message || String(e), "err"); } finally { setBusy(false); }
  }
  function save() {
    const raw = new Map<string, string>();   // threshold key -> value in stored units, as text
    box.current?.querySelectorAll<HTMLInputElement>("input[data-pk]").forEach(el => {
      const pd = Number(el.dataset.pd) || 1, t = el.value.trim(); raw.set(el.dataset.pk!, t === "" ? "" : String(Math.round((Number(t) / pd) * 1e6) / 1e6));
    });
    for (const [k] of EXTRA_KEYS) raw.set(k, (x[k] ?? "").trim());
    const out: any = {};
    for (const [k, label, , min, max, , sc] of PARAM_SECTIONS.flatMap((g: any) => g.items as any[])) {
      const t = raw.get(k), n = Number(t), lo = min / (sc || 1), hi = max / (sc || 1);
      if (t === undefined || t === "" || Number.isNaN(n) || n < lo || n > hi) return toast(`${label}: enter a number from ${lo} to ${hi}.`, "err");
      setParam(out, k, n);
    }
    if (out.crm_z_warn >= out.crm_z_fail) return toast("CRM warning |Z| must be below the fail |Z|.", "err");
    if (out.sent_warn_days > out.sent_fail_days) return toast("Sent warning days must not exceed the critical days.", "err");
    if (out.al_mid > out.al_hi || out.cr_mid > out.cr_hi) return toast("Medium limits must not exceed the high limits.", "err");
    write(out, "Parameters saved");
  }
  async function reset() { if (await ask("Reset every parameter to the built-in defaults for this site?", { title: "Reset parameters?", ok: "Reset", danger: true })) write({}, "Parameters reset to defaults"); }
  return (
    <div id="q-params" className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
      <p className="text-sm"><b>Editing is on.</b> Change the yellow cells in the table below, then save. Admins and super admins only; saved for this site.</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Also adjustable (not shown on the sheet): sample flow and survey checks</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EXTRA_KEYS.map(([k, label, unit, min, max, step]: any) => (
            <label key={k} className="flex flex-col gap-1 text-xs text-muted-foreground">{label}{unit ? ` (${unit})` : ""}
              <Input name={k} type="number" inputMode="decimal" min={min} max={max} step={step} value={x[k] ?? ""} onChange={e => setX(o => ({ ...o, [k]: e.target.value }))} className="h-9 text-foreground" />
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-xs text-muted-foreground">CRM certificate values come from the exp_crm table and are not edited here. The Excel workbook downloaded afterwards carries the new values in its yellow Parameter cells.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" id="q-params-save" onClick={save} disabled={busy || !navigator.onLine}>Save parameters</Button>
        <Button type="button" size="sm" variant="outline" id="q-params-reset" onClick={reset} disabled={busy || !navigator.onLine}>Reset to defaults</Button>
      </div>
    </div>
  );
}
