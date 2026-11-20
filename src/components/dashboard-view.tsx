"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileDown, RefreshCw } from "lucide-react";
import { core, type Info } from "@/lib/boot";
import { cn } from "@/lib/utils";
import * as Sp from "@/lib/dash-specs";
import { Button } from "./ui/button";
import { Card, CardTitle } from "./ui/card";
import { ChartCard, Kpi, useThemeKey } from "./chart-card";
import { useToast } from "./toast";

const STALE = 2 * 60 * 1000;
const MAPC: Record<string, [string, string, string]> = { planned: ["Planned", "#64748B", "#FFFFFF"], eoh: ["EOH", "#15803D", "#22C55E"], coh: ["COH", "#B45309", "#F59E0B"] };

function CollarMap({ d, C, f, cc }: { d: any; C: any; f: any; cc: any }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dead = false;
    import("@/lib/core/dash/map.js").then(m => { if (!dead && ref.current) m.renderCollarMap(ref.current, C.collarPoints(d, f)); });
    return () => { dead = true; import("@/lib/core/dash/map.js").then(m => m.destroyMap()); };
  }, [d, C, f]);
  return (
    <Card id="map-slot">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" id="g-maplegend">
        {Object.entries(MAPC).map(([k, [l, c, fl]]) => <span key={k} className="inline-flex items-center gap-1.5"><i className="inline-block size-3 rounded-full border-2" style={{ background: fl, borderColor: c }} />{l} <b>{nf(cc.counts[k] || 0)}</b></span>)}
        <span className="text-muted-foreground">{nf(cc.mapped)} of {nf(cc.total)} collars have coordinates</span>
      </div>
      <div ref={ref} id="g-map" className="relative h-[24rem] overflow-hidden rounded-lg border" />
    </Card>
  );
}
let cache: { site: string; data: any; at: number } | null = null;
const nf = (v: any, d = 0) => (v == null || Number.isNaN(v) ? "-" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const nid = (v: any, d = 0) => (v == null || Number.isNaN(v) ? "-" : Number(v).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (v: any, d = 1) => (v == null || Number.isNaN(v) ? "-" : nf(v, d) + "%");
const ach = (v: any) => (v == null ? undefined : v >= 100 ? "good" : v < 90 ? "bad" : undefined);
const Sec = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-3"><div><h2 className="text-lg font-semibold">{title}</h2>{note && <p className="text-sm text-muted-foreground">{note}</p>}</div>{children}</section>);
const Sel = ({ id, label, value, onChange, children }: any) => (
  <label className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">{label}</span>
    <select id={id} value={value} onChange={e => onChange(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2">{children}</select></label>);

export function useSiteData(info: Info) {
  const [st, setSt] = useState<{ data: any; err: string; loading: boolean }>({ data: null, err: "", loading: true });
  const load = useCallback(async (force = false) => {
    if (!navigator.onLine) return setSt({ data: null, err: "offline", loading: false });
    if (info.guest) return setSt({ data: null, err: "guest", loading: false });
    if (!force && cache && cache.site === info.site && Date.now() - cache.at < STALE) return setSt({ data: cache.data, err: "", loading: false });
    setSt(s => ({ ...s, loading: true, err: "" }));
    try {
      const { S } = await core(); const sb = S.getClient();
      const { data: sess } = await sb.auth.getSession();
      if (!sess?.session) throw new Error("Your login session has expired. Sign out, then sign in again while online.");
      const { loadSiteData } = await import("@/lib/core/dash/data.js");
      const data = await loadSiteData(sb, info.site); cache = { site: info.site, data, at: Date.now() };
      setSt({ data, err: "", loading: false });
    } catch (e: any) { setSt({ data: null, err: e.message || String(e), loading: false }); }
  }, [info.site, info.guest]);
  useEffect(() => { load(); }, [load]);
  return { ...st, reload: () => load(true), age: cache ? Math.round((Date.now() - cache.at) / 60000) : 0 };
}

export const NeedsOnline = ({ what, err, retry }: { what: string; err: string; retry: () => void }) => (
  <Card>
    <CardTitle>{err === "offline" ? `${what} needs internet` : err === "guest" ? "Log in first" : `${what} could not load`}</CardTitle>
    <div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-warning">
      {err === "offline" ? `${what} reads live data from the site database. Input and sync keep working offline.` : err === "guest" ? `Log in to see ${what.toLowerCase()}.` : err}
    </div>
    {/permission denied/i.test(err) && <p className="text-xs text-muted-foreground">&quot;permission denied for table&quot; means the database refused the role, not the row. Either the request ran without a login, or the table has no SELECT grant for the authenticated role at this site.</p>}
    {err !== "guest" && <div><Button variant="outline" id="d-retry" onClick={retry}>Try again</Button></div>}
  </Card>
);

export function DashboardView({ info }: { info: Info }) {
  const toast = useToast(); const [busy, setBusy] = useState(false);
  const { data: d, err, loading, reload, age } = useSiteData(info);
  const [prospect, setProspect] = useState(""); const [rig, setRig] = useState(""); const [period, setPeriod] = useState("daily");
  const tk = useThemeKey();
  const [C, setC] = useState<any>(null);
  useEffect(() => { import("@/lib/core/dash/calc.js").then(setC); }, []);

  const m = useMemo(() => {
    if (!d || !C) return null;
    const f = { prospect: prospect || null, rig: rig || null };
    const mtd = C.monthToDate(d, f);
    if (!mtd) return { none: true } as any;
    const dd = C.filterData(d, { ...f, from: mtd.from, to: mtd.to, rig: null });
    const hrs = new Map<string, { t: number; dr: number }>();
    for (const r of dd.dist) { const x = hrs.get(r.rig_id) || { t: 0, dr: 0 }; x.t += r.hours || 0; if (r.activity === "DRILLING") x.dr += r.hours || 0; hrs.set(r.rig_id, x); }
    const sp = C.samplesByProspect(d, f);
    const sum = (k: string) => sp.reduce((t: number, x: any) => t + (x[k] || 0), 0);
    const q = d.qaqcError ? null : Sp.qaqcModel(d, f);
    return { f, mtd, hrs, sp, sum, tot: sum("PENDING") + sum("SENT") + sum("ANALYZED"), prog: Sp.progressSpec(d, f, period), hours: Sp.hoursSpec(d, f), samples: Sp.samplesSpec(sp), q,
      prospects: C.prospectsOf(d), rigs: [...new Map(d.rigs.map((r: any) => [r.rig_id, r.rig_name])).entries()], cc: C.collarClassCounts(d, f) };
  }, [d, C, prospect, rig, period]);

  if (err) return <NeedsOnline what="Dashboard" err={err} retry={reload} />;
  if (loading || !d || !m) return <div className="text-sm text-muted-foreground" aria-busy>Loading dashboard…</div>;
  if (m.none) return <Card><div className="grid h-24 place-items-center text-sm text-muted-foreground">No drilling progress yet for this site.</div></Card>;
  const { mtd, q } = m;
  const stamp = () => new Date().toLocaleDateString("sv-SE");
  const save = (blob: Blob, name: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };
  const xlsx = async () => {
    try { const X: any = await import("@/lib/core/dash/export.js"); save(new Blob([X.buildDashWorkbook(d, m.f, { period })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `exploration_dashboard_${info.site}_${stamp()}.xlsx`); }
    catch (e: any) { toast("Excel export failed: " + (e.message || e), "err"); }
  };
  const pdf = async () => {
    setBusy(true);
    try {
      await (await import("./chart-card")).loadChartJs();
      const X: any = await import("@/lib/core/dash/export.js");
      const k = (k: string, v: any, s: string) => ({ k, v: String(v), s });
      const sections: any[] = [
        { title: "Drilling Progress", note: "Meters per period, stacked by rig; dashed line = plan.", kpis: [k("Meters drilled (MTD)", nf(mtd.meters), "Current month, all rigs"), k("Plan (MTD)", mtd.plan ? nf(mtd.plan) : "-", "Weekly plan spread over days"), k("Achievement", mtd.pct == null ? "-" : nf(mtd.pct, 1) + "%", "Actual / plan, MTD"), k("Holes drilled (MTD)", nf(mtd.holes), "Distinct holes")], specs: [m.prog] },
        { title: "Hour Distribution", note: "Hours per activity per rig, last 60 days.", specs: [m.hours] },
        { title: "Samples", note: "Lab status of samples (Pending, Sent, Analyzed).", kpis: [k("Samples", nf(m.tot), "In this selection"), k("Not sent to lab", nf(m.sum("PENDING")), "Status Pending"), k("Sent", nf(m.sum("SENT")), "Awaiting results"), k("Analyzed", nf(m.sum("ANALYZED")), "")], specs: [m.samples] },
      ];
      if (q) sections.push({ title: "QAQC Geokimia", kpis: [k("Sampel terkirim", nid(q.t.sent), `${nid(q.t.roa)} sudah ROA`), k("ROA belum diinput", nid(q.t.roaPending), "Terkirim, belum ada RoA PDF"), k("Excel QAQC tertunda", nid(q.t.qaqcPending), "Batch belum lengkap"), k("Insertion rate QC", q.t.rate == null ? "-" : nid(q.t.rate, 1) + "%", "")], specs: [Sp.flowSpec(q), Sp.blankSpec(q), Sp.dupSpec(q)] });
      const doc = await X.buildDashPdf(d, m.f, { sections, title: `Exploration Dashboard ${info.site}` });
      save(doc.output("blob"), `exploration_dashboard_${info.site}_${stamp()}.pdf`);
    } catch (e: any) { toast("PDF export failed: " + (e.message || e), "err"); } finally { setBusy(false); }
  };
  return (
    <div className="enter flex flex-col gap-6" id="dash">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-1 text-xs font-medium text-success">Live from {info.site}{age ? ` · ${age} min ago` : ""}</span>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" id="d-xlsx" onClick={xlsx}><Download />Excel</Button>
          <Button size="sm" variant="outline" id="d-pdf" onClick={pdf} disabled={busy}><FileDown />{busy ? "PDF…" : "PDF"}</Button>
          <Button size="sm" variant="outline" id="d-refresh" onClick={reload}><RefreshCw />Refresh</Button>
        </div>
      </div>
      <header>
        <h1 className="text-2xl font-semibold">Exploration Progress</h1>
        <p className="text-sm text-muted-foreground">Drilling progress, rig hour distribution and sample status, live from the site database.</p>
        <p className="mt-2 text-sm" id="d-take">Month to date (<b>{mtd.month}</b>): drilled <b>{nf(mtd.meters)}</b> m{mtd.plan ? <> of plan <b>{nf(mtd.plan)}</b> m (achievement <b className={cn(ach(mtd.pct) === "good" && "text-success", ach(mtd.pct) === "bad" && "text-danger")}>{nf(mtd.pct, 1)}%</b>)</> : " (no weekly plan entered)"}, {prospect ? `prospect ${prospect}` : "all prospects"}, all rigs.</p>
      </header>
      <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Dashboard filters">
        <Sel id="fProspect" label="Prospect" value={prospect} onChange={setProspect}><option value="">All prospects</option>{m.prospects.map((p: any) => <option key={p.code} value={p.code}>{p.name}</option>)}</Sel>
        <Sel id="fRig" label="Rig" value={rig} onChange={setRig}><option value="">All rigs</option>{m.rigs.map(([id, n]: any) => <option key={id} value={id}>{n}</option>)}</Sel>
        <div id="period" className="inline-flex overflow-hidden rounded-md border" role="group" aria-label="Aggregation period">
          {Object.entries(C.PERIODS).map(([k, v]: any) => <button key={k} data-period={k} aria-pressed={k === period} onClick={() => setPeriod(k)} className={cn("h-9 px-3 text-sm", k === period ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}>{v.label}</button>)}
        </div>
        <Button size="sm" variant="ghost" id="fReset" onClick={() => { setProspect(""); setRig(""); setPeriod("daily"); }}>Reset</Button>
      </div>

      <Sec title="Drilling Progress" note="Meters per period, stacked by rig; dashed line = plan. Filters and the period buttons apply to the chart; the cards are always month to date, all rigs.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Meters drilled (MTD)" value={nf(mtd.meters)} sub="Current month, all rigs" />
          <Kpi label="Plan (MTD)" value={mtd.plan ? nf(mtd.plan) : "-"} sub="Weekly plan spread over days" />
          <Kpi label="Achievement" value={mtd.pct == null ? "-" : nf(mtd.pct, 1) + "%"} sub="Actual / plan, MTD" tone={ach(mtd.pct) as any} />
          <Kpi label="Holes drilled (MTD)" value={nf(mtd.holes)} sub="Distinct holes, current month" />
        </div>
        <ChartCard spec={m.prog} themeKey={tk} />
        <Card id="rig-sum"><CardTitle>Rig summary, month to date</CardTitle>
          <p className="text-xs text-muted-foreground">Share = rig meters / total meters. Drilling hours % = Drilling share of the rig&apos;s logged hours this month. Plan is a site total, so there is no per-rig plan.</p>
          {mtd.rigs.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{["Rig", "Meters", "Share", "Holes", "Days", "m/day", "Recovery", "% Drilling hours"].map(h => <th key={h} className="whitespace-nowrap border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>)}</tr></thead><tbody>
            {mtd.rigs.map((r: any) => { const h = m.hrs.get(r.rig); return <tr key={r.rig}>{[r.name, nf(r.meters), pct(mtd.meters ? (r.meters / mtd.meters) * 100 : null), nf(r.holes), nf(r.days), nf(r.perDay, 1), pct(r.recovery), h && h.t ? pct((h.dr / h.t) * 100) : "-"].map((c, i) => <td key={i} className="border-b px-3 py-2 tabular-nums">{c}</td>)}</tr>; })}
          </tbody></table></div> : <div className="text-sm text-muted-foreground">No drilling this month</div>}
        </Card>
      </Sec>

      <Sec title="Hour Distribution" note="Hours per activity per rig, last 60 days. Prospect and rig filters apply; the period buttons do not."><ChartCard spec={m.hours} themeKey={tk} /></Sec>

      <Sec title="Samples" note="Lab status of samples (Pending, Sent, Analyzed). Prospect filter applies.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Samples" value={nf(m.tot)} sub="In this selection" />
          <Kpi label="Not sent to lab" value={nf(m.sum("PENDING"))} sub="Status Pending" tone={m.sum("PENDING") ? "bad" : undefined} />
          <Kpi label="Sent" value={nf(m.sum("SENT"))} sub="Awaiting results" />
          <Kpi label="Analyzed" value={nf(m.sum("ANALYZED"))} sub={m.tot ? pct((m.sum("ANALYZED") / m.tot) * 100, 0) + " of samples" : ""} />
        </div>
        <ChartCard spec={m.samples} themeKey={tk} />
      </Sec>

      <Sec title="Collar Map" note="Collars by class (Planned, EOH, COH) at their as-built position, or the planned position when there is none.">
        <CollarMap d={d} C={C} f={m.f} cc={m.cc} />
      </Sec>

      <Sec title="QAQC Geokimia" note="Terkirim = sampel dengan tanggal kirim ke lab. ROA diinput = hasil lab yang sudah di-import dari PDF RoA. Excel QAQC selesai = batch lab sudah punya minimal 1 blank, 1 CRM dan 1 duplikat.">
        {d.qaqcError || !q ? <Card><div className="text-sm text-muted-foreground">Data QAQC tidak bisa dimuat: {d.qaqcError}</div></Card> : <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Sampel terkirim" value={nid(q.t.sent)} sub={`${nid(q.t.roa)} sudah ROA, ${nid(q.t.qaqc)} Excel QAQC selesai`} />
            <Kpi label="ROA belum diinput" value={nid(q.t.roaPending)} sub="Terkirim, belum ada RoA PDF" tone={q.t.roaPending ? "bad" : undefined} />
            <Kpi label="Excel QAQC tertunda" value={nid(q.t.qaqcPending)} sub="Batch belum punya blank + CRM + duplikat" tone={q.t.qaqcPending ? "bad" : undefined} />
            <Kpi label="Insertion rate QC" value={q.t.rate == null ? "-" : nid(q.t.rate, 1) + "%"} sub={`${nid(q.t.qc)} sampel QC dari ${nid(q.t.sent)} terkirim`} />
          </div>
          <ChartCard spec={Sp.flowSpec(q)} themeKey={tk} />
          <div className="grid gap-3 sm:grid-cols-3" id="q-fail">
            <Kpi label="Blank gagal" value={nid(q.ck.fail.blank)} of={nid(q.ck.blanks.length)} tone={q.ck.fail.blank ? "bad" : undefined} sub={`Ni > ${nid(q.T.blank_ni_max, 2)}% dianggap terkontaminasi`} />
            <Kpi label="CRM gagal" value={nid(q.ck.fail.crm)} of={nid(q.ck.crms.length)} tone={q.ck.fail.crm ? "bad" : undefined} sub={`Di luar ±${nid(q.T.crm_z_fail)}SD nilai sertifikat`} />
            <Kpi label="Duplikat gagal" value={nid(q.ck.fail.dup)} of={nid(q.ck.dups.length)} tone={q.ck.fail.dup ? "bad" : undefined} sub={"Selisih relatif pasangan > " + [...new Set(Object.values(q.T.dup_ard_ni_max).map((v: any) => nid(v * 100) + "%"))].join(" / ")} />
          </div>
          <ChartCard spec={Sp.blankSpec(q)} themeKey={tk} />
          <ChartCard spec={Sp.dupSpec(q)} themeKey={tk} />
        </>}
      </Sec>
    </div>
  );
}
