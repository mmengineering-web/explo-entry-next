"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export type ChartSpec = { id?: string; title: string; sub?: string; head: string[]; rows: (string | number)[][]; tall?: boolean; make: (cv: HTMLCanvasElement) => any };

// Chart.js is loaded once from /vendor and redrawn when the light/dark theme changes (colours come from CSS tokens).
let loading: Promise<void> | null = null;
export function loadChartJs(): Promise<void> {
  const w = window as any;
  if (w.Chart) return Promise.resolve();
  if (!loading) loading = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "/vendor/chart.umd.min.js"; s.onload = () => res();
    s.onerror = () => { loading = null; rej(new Error("Could not load the chart library. Open this tab once while online.")); };
    document.head.appendChild(s);
  });
  return loading;
}
export function useThemeKey() {
  const [k, setK] = useState(0);
  useEffect(() => {
    const mo = new MutationObserver(() => setK(n => n + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return k;
}

export function ChartCard({ spec, themeKey }: { spec: ChartSpec; themeKey: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [table, setTable] = useState(false);
  const has = spec.rows.length > 0;
  useEffect(() => {
    if (!has || table || !ref.current) return;
    let chart: any, dead = false;
    (async () => {
      await loadChartJs();
      const ui: any = await import("@/lib/core/dash/ui.js");
      if (dead || !ref.current) return;
      ui.syncChartColors();
      chart = spec.make(ref.current);
    })();
    return () => { dead = true; chart?.destroy(); };
  }, [spec, has, table, themeKey]);
  return (
    <Card className="min-w-0" data-chart={spec.id}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="text-base font-semibold">{spec.title}</h3>{spec.sub && <p className="text-xs text-muted-foreground">{spec.sub}</p>}</div>
        {has && <Button size="sm" variant="outline" data-t onClick={() => setTable(t => !t)}>{table ? "Chart" : "Table"}</Button>}
      </div>
      {!has ? <div className="grid h-24 place-items-center text-sm text-muted-foreground">No data for this selection</div>
        : table ? (
          <div className="max-h-96 overflow-auto rounded-md border"><table className="w-full text-sm"><thead className="sticky top-0 bg-muted"><tr>{spec.head.map(h => <th key={h} className="whitespace-nowrap border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>)}</tr></thead>
            <tbody>{spec.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b px-3 py-1.5 tabular-nums">{c}</td>)}</tr>)}</tbody></table></div>
        ) : <div className={cn("relative w-full", spec.tall ? "h-80" : "h-64")}><canvas ref={ref} role="img" aria-label={spec.title} /></div>}
    </Card>
  );
}

export const Kpi = ({ label, value, sub, tone, of }: { label: string; value: React.ReactNode; sub?: string; tone?: "good" | "bad"; of?: React.ReactNode }) => (
  <div className="rounded-xl border bg-card p-4 shadow-sm">
    <div className="text-xs font-medium text-muted-foreground">{label}</div>
    <div className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "good" && "text-success", tone === "bad" && "text-danger")}>{value}{of && <span className="text-sm font-normal text-muted-foreground"> / {of}</span>}</div>
    {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
  </div>
);
