"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { FileUp } from "lucide-react";
import { core, canForm, type Info } from "@/lib/boot";
import { useToast } from "./toast";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardTitle } from "./ui/card";

const esc = (s: any) => String(s ?? "");
const f2 = (v: any) => (v == null ? "" : String(Math.round(v * 100) / 100));
const Note = ({ kind, children }: { kind: "err" | "warn" | "ok"; children: React.ReactNode }) => (
  <div className={`rounded-md border px-3 py-2 text-sm ${kind === "err" ? "border-[var(--danger-border)] bg-[var(--danger-bg)] text-danger" : kind === "ok" ? "border-[var(--success-border)] bg-[var(--success-bg)] text-success" : "border-[var(--warning-border)] bg-[var(--warning-bg)] text-warning"}`}>{children}</div>
);
const Th = ({ children }: { children?: React.ReactNode }) => <th className="sticky top-0 whitespace-nowrap border-b bg-muted px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{children}</th>;

// RoA Lab (lab Report of Analysis, PDF): read, preview, save into exp_assay. Returns the card (same shape as the Excel card) and the result block.
export function useRoa(info: Info) {
  const toast = useToast();
  const canSave = canForm(info, "sample");
  const [lab, setLab] = useState(""); const [file, setFile] = useState(""); const [plan, setPlan] = useState<any>(null);
  const [msg, setMsg] = useState<{ kind: "err" | "ok" | "info"; text: string } | null>(null);
  const [withWarn, setWithWarn] = useState(true); const [shown, setShown] = useState(150); const [saved, setSaved] = useState("");

  async function pick(f?: File) {
    if (!f) return;
    setMsg({ kind: "info", text: "Membaca PDF…" }); setPlan(null); setSaved("");
    try {
      const { D } = await core();
      const [{ readPdf }, { parseReport }, { plan: mkPlan }] = await Promise.all([import("@/lib/core/roa/pdf.js"), import("@/lib/core/roa/parse.js"), import("@/lib/core/roa/commit.js")]) as any;
      const [pages, samples, collars, assays] = await Promise.all([readPdf(f), D.db.samples.filter((s: any) => !s.is_deleted).toArray(), D.db.collars.filter((c: any) => !c.is_deleted).toArray(), D.db.assays.toArray()]);
      const rep = parseReport(pages, samples);
      if (!rep.rows.length) throw new Error("Tabel hasil tidak ditemukan. Pastikan ini PDF asli dari lab (bukan hasil scan/foto).");
      const name = lab || (rep.header.ref_no || "").split("/")[0] || "";
      setLab(name); setFile(f.name); setShown(150); setMsg(null);
      setPlan(mkPlan(rep, { collars: new Set(collars.map((c: any) => c.hole_id)), assays, file: f.name, lab: name }));
    } catch (e: any) { console.error(e); setMsg({ kind: "err", text: e.message || String(e) }); }
  }

  const save = plan ? plan.items.filter((i: any) => i.rec && (withWarn || i.status === "ok")) : [];
  async function commit() {
    setMsg({ kind: "info", text: "Menyimpan…" });
    try {
      const { D, S } = await core(); const recs = save.map((i: any) => ({ ...i.rec, lab: lab || null }));
      await D.saveMany("assays", recs); S.syncSoon(300);
      setSaved(`${recs.length} baris disimpan dari ${file}. Terkirim ke server saat online. Lihat hasil QC di Data QC.`); setPlan(null); setMsg(null); toast(`${recs.length} baris RoA disimpan`);
    } catch (e: any) { setMsg(null); toast(e.message || String(e), "err"); }
  }

  const card = (
    <Card id="roa-card" className="flex flex-col">
      <CardTitle>Import RoA Lab</CardTitle>
      <p className="text-sm text-muted-foreground">Baca Report of Analysis (PDF) dari lab: sampel utama, blank, CRM, dan duplikat ikut terbaca. Baris yang sudah pernah diimport (nomor sampel atau batch sama) dilewati, jadi aman diulang. Data disimpan di HP dan dikirim saat online.</p>
      <div className="mt-auto flex flex-wrap items-end gap-3">
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs text-muted-foreground">Nama lab
          <Input id="roa-lab" value={lab} onChange={e => setLab(e.target.value.trim())} placeholder="mis. CDSM" className="h-10 text-foreground" />
        </label>
        <label className={`inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground ${canSave ? "cursor-pointer hover:opacity-90" : "pointer-events-none opacity-50"}`}>
          <FileUp className="size-4" />Pilih file RoA (PDF)
          <input id="roa-file" type="file" accept="application/pdf,.pdf" className="sr-only" disabled={!canSave} onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      <div id="roa-msg">{msg && (msg.kind === "info" ? <p className="text-sm text-muted-foreground">{msg.text}</p> : <Note kind={msg.kind}>{msg.text}</Note>)}
        {!canSave && <Note kind="warn">Akun ini tidak boleh input data sampel.</Note>}</div>
    </Card>
  );

  let result: React.ReactNode = null;
  if (saved) result = <Card><Note kind="ok">{saved}</Note></Card>;
  else if (plan) {
    const h = plan.header, c = plan.counts, critical = plan.msgs.some((m: any) => m.sev === "critical");
    result = (
      <div id="roa-out" className="flex flex-col gap-4">
        <Card>
          <h3 className="text-base font-semibold">{esc(h.batch_id || "?")} <span className="text-sm font-normal text-muted-foreground">laporan {esc(h.report_no || "-")} · terima {esc(h.received_date || "-")} · uji {esc(h.tested_date || "-")} · terbit {esc(h.reported_date || "-")}</span></h3>
          <p className="text-sm">{c.PRIMARY || 0} sampel utama · {c.DUPLICATE || 0} duplikat · {c.CRM || 0} CRM · {c.BLANK || 0} blank, <b>{save.length}</b> akan disimpan, {c.skip} dilewati, {c.warn} perlu dicek.</p>
          {plan.msgs.map((m: any, i: number) => <Note key={i} kind={m.sev === "critical" ? "err" : "warn"}>{m.text}</Note>)}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" id="roa-warn" checked={withWarn} onChange={e => setWithWarn(e.target.checked)} /> Simpan juga baris bertanda ⚠ (interval diturunkan dari ID, hole belum ada collar, dll.)</label>
          <div><Button id="roa-go" disabled={!canSave || !save.length || critical} onClick={commit}>Simpan {save.length} baris</Button></div>
        </Card>
        <Card className="p-0">
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm"><thead><tr>{["#", "Sampel", "Tipe", "Hole", "Interval", "Ni", "Fe", "MgO", "SiO₂", "Status"].map(x => <Th key={x}>{x}</Th>)}</tr></thead>
              <tbody>{plan.items.slice(0, shown).map((i: any, n: number) => { const r = i.row, v = r.values; return (
                <tr key={n} className={i.status === "warn" ? "bg-[var(--warning-bg)]" : i.status === "skip" ? "bg-muted text-muted-foreground" : ""}>
                  {[r.lab_seq, r.sample_id, r.kind, r.hole_id || "", r.from_m != null ? `${f2(r.from_m)}–${f2(r.to_m)}` : "", f2(v.Ni), f2(v.Fe), f2(v.MgO), f2(v.SiO2), `${i.status === "skip" ? "dilewati" : i.status === "warn" ? "⚠" : "✓"} ${i.flags.join("; ")}`].map((x, k) => <td key={k} className="whitespace-nowrap border-b px-3 py-1.5">{x}</td>)}
                </tr>); })}</tbody></table>
          </div>
          {plan.items.length > shown && <div className="p-3"><Button size="sm" variant="outline" onClick={() => setShown(s => s + 400)}>Tampilkan lebih banyak ({plan.items.length - shown} lagi)</Button></div>}
        </Card>
      </div>
    );
  }
  return { card, result };
}
