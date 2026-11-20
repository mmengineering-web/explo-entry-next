"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, RefreshCw, Share2 } from "lucide-react";
import { core, type Info } from "@/lib/boot";
import { useToast } from "./toast";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardTitle } from "./ui/card";
import { Field, today } from "./form-kit";

const ls = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
let lastDate = "";

export function ReportView({ info, tick }: { info: Info; tick?: string }) {
  const toast = useToast();
  const [date, setDate] = useState(lastDate || today());
  const [title, setTitle] = useState(() => ls(`exp_report_title_${info.site}`, info.site));
  const [company, setCompany] = useState(() => ls(`exp_report_company_${info.site}`, ""));
  const [text, setText] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const area = useRef<HTMLTextAreaElement>(null);
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  const gen = useCallback(async () => {
    const { D, cfg } = await core();
    const mod: any = await import("@/lib/core/report.js");
    const [collars, progress, disthours, samples, rigs] = await Promise.all(["collars", "progress", "disthours", "samples", "rigs"].map(t => D.db[t].toArray()));
    const statusClass = (code: string) => { const m = cfg.metaOf("collar_status", code); return m.map_class === "planned" || (!m.map_class && m.is_plan) ? "planned" : m.map_class === "progress" ? "coh" : m.map_class || "coh"; };
    const r = mod.buildReport({ date, title, company, collars, progress, disthours, samples, rigs, statusClass,
      actLabel: (a: string) => cfg.labelOf("activity", a), reasonLabel: (a: string) => cfg.labelOf("downtime_reason", a) });
    setText(r.text); setWarnings(r.warnings || []); setBusy(false);
  }, [date, title, company]);

  useEffect(() => { gen(); }, [gen, tick]);
  useEffect(() => {
    lastDate = date;
    try { localStorage.setItem(`exp_report_title_${info.site}`, title); localStorage.setItem(`exp_report_company_${info.site}`, company); } catch {}
  }, [date, title, company, info.site]);

  async function copy() {
    try { await navigator.clipboard.writeText(text); } catch { area.current?.select(); document.execCommand("copy"); }
    toast("Teks laporan disalin");
  }

  return (
    <div className="enter flex flex-col gap-5">
      <Card id="rep">
        <CardTitle>Laporan harian</CardTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tanggal"><Input id="r-date" type="date" value={date} onChange={e => setDate(e.target.value || today())} /></Field>
          <Field label="Judul"><Input id="r-title" value={title} placeholder="mis. GMS-CDSM" onChange={e => setTitle(e.target.value)} /></Field>
          <Field label="Perusahaan"><Input id="r-co" value={company} placeholder="mis. PT GMS" onChange={e => setCompany(e.target.value)} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">Disusun dari data di HP ini (sync dulu agar lengkap). Teks boleh diedit sebelum disalin.</p>
        <div id="r-warn" className="flex flex-col gap-2">{warnings.map(w => <div key={w} className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-warning">{w}</div>)}</div>
        <textarea ref={area} id="r-text" rows={26} value={text} onChange={e => setText(e.target.value)} aria-busy={busy}
          className="w-full rounded-md border border-input bg-card p-3 font-mono text-[13px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
        <div className="flex flex-wrap gap-3">
          <Button onClick={copy} id="r-copy"><Copy />Salin</Button>
          {canShare && <Button variant="outline" id="r-share" onClick={() => navigator.share({ text }).catch(() => {})}><Share2 />Bagikan</Button>}
          <Button variant="outline" id="r-regen" onClick={gen}><RefreshCw />Susun ulang</Button>
        </div>
      </Card>
    </div>
  );
}
