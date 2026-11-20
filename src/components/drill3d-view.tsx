"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { core, type Info } from "@/lib/boot";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Card, CardTitle } from "./ui/card";
import { NeedsOnline } from "./dashboard-view";
import { CLASS_COLORS, CLASS_ORDER, MODES, buildModel, rampColor, segments } from "@/lib/core/geo3d.js";

// three.js and react-three-fiber load only when this tab opens in 3D.
const DrillScene = lazy(() => import("./drill3d-scene"));

let cache: { site: string; data: any; at: number } | null = null;
const STALE = 2 * 60 * 1000;
const nf = (v: any, d = 1) => (v == null || Number.isNaN(v) ? "-" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));

// 3D needs WebGL and a device that can take it. Old or low-memory phones start in the 2D view.
function capability() {
  let webgl = false;
  try { const c = document.createElement("canvas"); webgl = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { /* none */ }
  const n: any = navigator;
  const low = (n.deviceMemory && n.deviceMemory <= 2) || (n.hardwareConcurrency && n.hardwareConcurrency <= 2) || matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { webgl, low: !!low };
}

function Seg({ on, set, items }: { on: string; set: (k: string) => void; items: [string, string][] }) {
  return (
    <div className="inline-flex rounded-md border border-input bg-card p-0.5" role="group">
      {items.map(([k, l]) => (
        <button key={k} type="button" data-k={k} aria-pressed={on === k} onClick={() => set(k)}
          className={cn("h-[var(--control-h-sm)] rounded-[5px] px-3 text-sm font-medium transition-colors", on === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>{l}</button>
      ))}
    </div>
  );
}

function Legend({ mode }: { mode: string }) {
  if (mode === "cls") return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" id="d3-legend">
      {CLASS_ORDER.map(k => <span key={k} className="inline-flex items-center gap-1.5"><i className="size-3 rounded-sm border border-black/20" style={{ background: CLASS_COLORS[k as keyof typeof CLASS_COLORS] }} />{k}</span>)}
      <span className="inline-flex items-center gap-1.5 text-muted-foreground"><i className="size-3 rounded-sm" style={{ background: "#8a8178" }} />no assay</span>
    </div>
  );
  const m = (MODES as any)[mode];
  return (
    <div className="flex items-center gap-2 text-xs" id="d3-legend">
      <span>0</span><span className="h-3 w-40 rounded-sm border border-black/20" style={{ background: `linear-gradient(90deg,${[0, .2, .4, .6, .8, 1].map(rampColor).join(",")})` }} /><span>{m.max}+ {m.label}</span>
      <span className="inline-flex items-center gap-1.5 text-muted-foreground"><i className="size-3 rounded-sm" style={{ background: "#8a8178" }} />no assay</span>
    </div>
  );
}

// 2D fallback (and a useful view on its own): plan and a section along a chosen bearing. Plain SVG, no WebGL.
function Plot({ title, id, lines, pts, selected, onPick, aspect }: any) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const l of lines) { x0 = Math.min(x0, l.x1, l.x2); x1 = Math.max(x1, l.x1, l.x2); y0 = Math.min(y0, l.y1, l.y2); y1 = Math.max(y1, l.y1, l.y2); }
  if (!isFinite(x0)) return null;
  const span = Math.max(x1 - x0, y1 - y0, 20), pad = span * 0.08, fs = span / 38;
  const vb = [x0 - pad, y0 - pad - fs * 1.4, x1 - x0 + pad * 2, y1 - y0 + pad * 2 + fs * 1.4];
  return (
    <figure className="m-0 flex flex-col gap-1">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      <svg id={id} viewBox={vb.join(" ")} preserveAspectRatio="xMidYMid meet" className="w-full rounded-lg border bg-card" style={{ height: aspect }} role="img" aria-label={title}>
        {lines.map((l: any, i: number) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color || "#8a8178"} strokeWidth={l.sel ? 6 : 3.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={selected && !l.sel ? 0.55 : 1} />)}
        {pts.map((p: any) => (
          <g key={p.id} className="cursor-pointer" onClick={() => onPick(p.id)}>
            <circle cx={p.x} cy={p.y} r={fs * (p.sel ? 0.8 : 0.55)} fill={p.sel ? "var(--foreground)" : "var(--muted-foreground)"} />
            <text x={p.x} y={p.y - fs} fontSize={fs} textAnchor="middle" fill="var(--foreground)" stroke="var(--card)" strokeWidth={fs / 5} paintOrder="stroke">{p.id}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
function TwoD({ model, holes, mode, selected, onPick, az, setAz }: any) {
  const { plan, planPts, sec, secPts } = useMemo(() => {
    const a = (az * Math.PI) / 180, sa = Math.sin(a), ca = Math.cos(a);
    const plan: any[] = [], planPts: any[] = [], sec: any[] = [], secPts: any[] = [];
    for (const h of holes) {
      const sg = segments(model, h, mode, 1), sel = h.id === selected;
      for (const s of sg) {
        plan.push({ x1: s.a[0], y1: s.a[2], x2: s.b[0], y2: s.b[2], color: s.color, sel });
        const f = (p: number[]) => [p[0] * sa + -p[2] * ca, -p[1]];
        const [ax, ay] = f(s.a), [bx, by] = f(s.b); sec.push({ x1: ax, y1: ay, x2: bx, y2: by, color: s.color, sel });
      }
      if (sg.length) { planPts.push({ id: h.id, x: sg[0].a[0], y: sg[0].a[2], sel }); const [sx, sy] = [sg[0].a[0] * sa + -sg[0].a[2] * ca, -sg[0].a[1]]; secPts.push({ id: h.id, x: sx, y: sy, sel }); }
    }
    return { plan, planPts, sec, secPts };
  }, [model, holes, mode, selected, az]);
  return (
    <div className="flex flex-col gap-3" id="d3-2d">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">Section along bearing
          <select value={az} onChange={e => setAz(Number(e.target.value))} className="h-[var(--control-h-sm)] rounded-md border border-input bg-card px-2" id="d3-az">
            {[0, 30, 45, 60, 90, 120, 135, 150].map(v => <option key={v} value={v}>{v}°{v === 0 ? " (N-S)" : v === 90 ? " (E-W)" : ""}</option>)}
          </select>
        </label>
        <span className="text-xs text-muted-foreground">Plan has north up. Sections are drawn at true scale, holes projected onto the line.</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Plot title="Plan view" id="d3-plan" lines={plan} pts={planPts} selected={selected} onPick={onPick} aspect={340} />
        <Plot title={`Section along ${az}°`} id="d3-sec" lines={sec} pts={secPts} selected={selected} onPick={onPick} aspect={340} />
      </div>
    </div>
  );
}

function Detail({ h, onClose }: { h: any; onClose: () => void }) {
  return (
    <Card id="d3-detail">
      <div className="flex items-start justify-between gap-2">
        <CardTitle>{h.id}</CardTitle>
        <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {[h.type, h.prospect, h.status].filter(Boolean).join(" · ") || "-"} · depth {nf(h.total)} m · E {nf(h.e, 0)} N {nf(h.n, 0)} RL {nf(h.rl)}
        {h.assumedVertical ? " · no dip or survey, drawn vertical" : h.surveyed ? " · surveyed" : ""}
      </p>
      {h.intervals.length ? (
        <div className="max-h-64 overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card"><tr>{["From", "To", "Ni %", "Fe %", "MgO %", "Class"].map(c => <th key={c} className="border-b px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground">{c}</th>)}</tr></thead>
            <tbody>{h.intervals.map((iv: any, i: number) => (
              <tr key={i}><td className="border-b px-3 py-1.5">{nf(iv.from)}</td><td className="border-b px-3 py-1.5">{nf(iv.to)}</td><td className="border-b px-3 py-1.5">{nf(iv.ni, 2)}</td><td className="border-b px-3 py-1.5">{nf(iv.fe)}</td><td className="border-b px-3 py-1.5">{nf(iv.mgo)}</td>
                <td className="border-b px-3 py-1.5">{iv.cls ? <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded-sm border border-black/20" style={{ background: CLASS_COLORS[iv.cls as keyof typeof CLASS_COLORS] }} />{iv.cls}</span> : "-"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="text-sm text-muted-foreground">No assay intervals for this hole yet.</p>}
    </Card>
  );
}

export function Drill3dView({ info }: { info: Info }) {
  const [st, setSt] = useState<{ data: any; err: string; loading: boolean }>({ data: null, err: "", loading: true });
  const [mode, setMode] = useState("cls"), [pros, setPros] = useState(""), [exag, setExag] = useState(1), [labels, setLabels] = useState(true);
  const [sel, setSel] = useState<string | null>(null), [resetKey, setResetKey] = useState(0), [az, setAz] = useState(90);
  const [cap, setCap] = useState<{ webgl: boolean; low: boolean } | null>(null), [mode3, setMode3] = useState<"3d" | "2d" | null>(null);
  useEffect(() => { const c = capability(); setCap(c); setMode3(c.webgl && !c.low ? "3d" : "2d"); }, []);

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

  const model = useMemo(() => (st.data ? buildModel(st.data) : null), [st.data]);
  const prospects = useMemo(() => [...new Set((model?.holes || []).map((h: any) => h.prospect).filter(Boolean))].sort() as string[], [model]);
  const holes = useMemo(() => (model?.holes || []).filter((h: any) => !pros || h.prospect === pros), [model, pros]);
  const picked = holes.find((h: any) => h.id === sel) || null;

  if (st.err) return <NeedsOnline what="3D Hole" err={st.err} retry={() => load(true)} />;
  if (st.loading || !model || !cap || !mode3) return <div className="text-sm text-muted-foreground" aria-busy>Loading drill holes…</div>;
  const nAssay = holes.reduce((s: number, h: any) => s + h.intervals.length, 0);

  return (
    <div className="enter flex flex-col gap-4" id="d3-view">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight">3D Hole</h2>
          <p className="text-sm text-muted-foreground" id="d3-note">
            {holes.length} holes, {nAssay} assay intervals. Live from the site database{model.skipped.length ? `; ${model.skipped.length} without coordinates or depth are not shown` : ""}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} id="d3-refresh">Refresh</Button>
      </div>

      <Card className="gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Seg on={mode} set={setMode} items={Object.entries(MODES).map(([k, v]: any) => [k, v.label])} />
          {prospects.length > 1 && (
            <select value={pros} onChange={e => { setPros(e.target.value); setSel(null); }} aria-label="Prospect" id="d3-pros" className="h-[var(--control-h-sm)] rounded-md border border-input bg-card px-2 text-sm">
              <option value="">All prospects</option>{prospects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          <Seg on={mode3} set={k => setMode3(k as any)} items={[["3d", "3D"], ["2d", "Plan + section"]]} />
          {mode3 === "3d" && <>
            <label className="flex items-center gap-2 text-sm">Vertical ×
              <input type="range" min={1} max={5} step={0.5} value={exag} onChange={e => setExag(Number(e.target.value))} id="d3-exag" className="w-24 accent-[var(--primary)]" /><b className="w-6">{exag}</b>
            </label>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)} id="d3-labels" />Labels</label>
            <Button size="sm" variant="outline" onClick={() => setResetKey(k => k + 1)} id="d3-reset">Reset view</Button>
          </>}
        </div>
        <Legend mode={mode} />
        {cap.low && cap.webgl && mode3 === "2d" && <p className="text-xs text-muted-foreground" id="d3-low">This device looks low on power, so the simple view is on. Switch to 3D if you want it.</p>}
        {!cap.webgl && <p className="text-xs text-muted-foreground" id="d3-nogl">3D needs WebGL, which this browser does not offer. The plan and section view works everywhere.</p>}
      </Card>

      {!holes.length ? (
        <Card><CardTitle>Nothing to draw yet</CardTitle><p className="text-sm text-muted-foreground">Holes need coordinates and a depth. Add as-built or planned lat/lon on the Collar tab.</p></Card>
      ) : mode3 === "3d" ? (
        <div className="relative h-[min(70vh,640px)] min-h-[320px] overflow-hidden rounded-xl border bg-card" id="d3-stage" data-ready="1">
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading 3D engine…</div>}>
            <DrillScene model={model} holes={holes} mode={mode} exag={exag} selected={sel} labels={labels && holes.length <= 80} low={cap.low} resetKey={resetKey} onPick={setSel} />
          </Suspense>
        </div>
      ) : (
        <TwoD model={model} holes={holes} mode={mode} selected={sel} onPick={setSel} az={az} setAz={setAz} />
      )}

      {picked && <Detail h={picked} onClose={() => setSel(null)} />}

      {holes.length > 0 && (
        <Card>
          <CardTitle>Holes</CardTitle>
          <div className="max-h-64 overflow-auto rounded-md border" id="d3-list">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card"><tr>{["Hole", "Type", "Prospect", "Depth m", "Assays", "Note"].map(c => <th key={c} className="border-b px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground">{c}</th>)}</tr></thead>
              <tbody>{holes.map((h: any) => (
                <tr key={h.id} className={cn("cursor-pointer hover:bg-accent", h.id === sel && "bg-accent")} onClick={() => setSel(h.id === sel ? null : h.id)}>
                  <td className="border-b px-3 py-1.5 font-medium"><button type="button" className="text-left underline-offset-2 hover:underline" aria-pressed={h.id === sel}>{h.id}</button></td>
                  <td className="border-b px-3 py-1.5">{h.type || "-"}</td><td className="border-b px-3 py-1.5">{h.prospect || "-"}</td><td className="border-b px-3 py-1.5">{nf(h.total)}</td><td className="border-b px-3 py-1.5">{h.intervals.length}</td>
                  <td className="border-b px-3 py-1.5 text-xs text-muted-foreground">{h.assumedVertical ? "drawn vertical" : h.surveyed ? "surveyed" : "collar dip"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
