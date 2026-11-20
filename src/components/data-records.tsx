"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileArchive } from "lucide-react";
import { core, canForm, type Info } from "@/lib/boot";
import { setEditing, FORM_OF, TAB_OF } from "@/lib/editing";
import { decorated, makeCols } from "@/lib/rec-cols";
import { useToast } from "./toast";
import { Button } from "./ui/button";
import { Card, CardTitle } from "./ui/card";
import { t5 } from "./form-kit";
import { RecordList, type Col } from "./record-list";

const FORM_LAB: Record<string, string> = { progress: "Drilling Progress", collars: "Collar", disthours: "Distribution Hour", surveys: "Survey", samples: "Sample", assays: "Assay" };
const TABLES = ["progress", "collars", "disthours", "surveys", "samples", "assays"] as const;
const SORTS: Record<string, { k: string; dir: 1 | -1 }> = { progress: { k: "work_date", dir: -1 }, collars: { k: "hole_id", dir: 1 }, disthours: { k: "work_date", dir: -1 }, surveys: { k: "hole_id", dir: 1 }, samples: { k: "hole_id", dir: 1 }, assays: { k: "hole_id", dir: 1 } };
const fmtH = (h: number) => String(Math.round(h * 100) / 100);

function save(blob: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
function deviceCode() {
  let c = localStorage.getItem("exp_device");
  if (!c) { c = Array.from(crypto.getRandomValues(new Uint8Array(2)), b => "ABCDEFGHJKLMNPQRSTUVWXYZ"[b % 24]).join(""); localStorage.setItem("exp_device", c); }
  return c;
}

export function DataRecords({ info, tick, go }: { info: Info; tick?: string; go: (tab: string) => void }) {
  const toast = useToast();
  const [d, setD] = useState<{ cols: Record<string, Col[]>; comb: any[]; combCols: Col[]; byTbl: Record<string, any[]>; pending: number } | null>(null);
  const [photoMsg, setPhotoMsg] = useState(""); const [photoBusy, setPhotoBusy] = useState(false);
  const shown = useRef<Record<string, any[]>>({});

  const load = useCallback(async () => {
    const { D, cfg, V } = await core();
    const cols = makeCols(cfg, V);
    const live = await Promise.all(TABLES.map(t => D.db[t].filter((x: any) => !x.is_deleted).toArray()));
    const byTbl: Record<string, any[]> = {};
    for (let i = 0; i < TABLES.length; i++) byTbl[TABLES[i]] = await decorated(D, TABLES[i], live[i]);
    const L = cfg.labelOf;
    const dOf = (r: any) => (r.updated_at || "").slice(0, 10);
    const row = (tbl: string, r: any, date: string, hole: string, rig: string, detail: string, status: string) => ({ _tbl: tbl, id: r.id, date, hole, rig, detail, status, _sync: r._sync });
    const comb = [
      ...byTbl.progress.map(r => row("progress", r, r.work_date, r.hole_id, r.rig_id, `${r.from_m}–${r.to_m} m${r.layer ? " · " + L("layer", r.layer) : ""} · ${L("shift", r.shift)}`, "")),
      ...byTbl.collars.map(r => row("collars", r, dOf(r), r.hole_id, "", `${L("hole_type", r.hole_type)}${r.prospect ? " · " + r.prospect : ""}${r.total_depth_m != null ? " · TD " + r.total_depth_m + " m" : ""}`, L("collar_status", r.status))),
      ...byTbl.disthours.map(r => row("disthours", r, r.work_date, "", r.rig_id, `${t5(r.from_time)}–${t5(r.to_time)} · ${L("activity", r.activity)} (${fmtH(V.hoursOf(r))} jam)`, "")),
      ...byTbl.surveys.map(r => row("surveys", r, r.survey_date || dOf(r), r.hole_id, "", `${r.depth_m} m · dip ${r.dip_deg}° · az ${r.azimuth_deg}°${r.method ? " · " + r.method : ""}`, "")),
      ...byTbl.samples.map(r => row("samples", r, r.sampled_date || dOf(r), r.hole_id, "", `${r.sample_no} · ${r.from_m}–${r.to_m} m · ${L("sample_type", r.sample_type)}`, L("sample_status", r.status))),
      ...byTbl.assays.map(r => row("assays", r, dOf(r), r.hole_id || "", "", `${r.from_m != null ? `${r.from_m}–${r.to_m} m` : r.sample_type}${r.sample_no ? " · " + r.sample_no : ""} · Ni ${r.ni_pct ?? "–"} · Fe ${r.fe_pct ?? "–"}`, "")),
    ];
    const sync = cols.collars[cols.collars.length - 1];
    const combCols: Col[] = [
      { k: "_tbl", label: "Form", type: "enum", get: r => r._tbl, lab: v => FORM_LAB[v] || v },
      { k: "date", label: "Tanggal / update", type: "date", get: r => r.date },
      { k: "hole", label: "Hole ID", type: "text", get: r => r.hole, cls: "font-medium" },
      { k: "rig", label: "Rig", type: "enum", get: r => r.rig },
      { k: "detail", label: "Detail", type: "text", get: r => r.detail },
      { k: "status", label: "Status", type: "enum", get: r => r.status },
      sync,
    ];
    const pending = (await D.db.outbox.count());
    setD({ cols, comb, combCols, byTbl, pending });
  }, []);
  const V = useRef<any>(null);
  useEffect(() => { core().then(c => { V.current = c.V; load(); }); }, [load, tick]);

  if (!d) return <div className="text-sm text-muted-foreground" aria-busy>Memuat…</div>;
  const open = (tbl: string, id: string) => {
    core().then(async ({ D }) => { const rec = await D.db[tbl].get(id); if (!rec) return; setEditing(tbl, rec); go(TAB_OF[tbl]); });
  };
  const opener = (tbl: string) => (FORM_OF[tbl] ? (r: any) => open(tbl, r.id) : null);
  const canOpenTbl = (tbl: string) => !!FORM_OF[tbl] && canForm(info, FORM_OF[tbl]);
  const n = (t: string) => d.byTbl[t].length;

  async function exportExcel(onlyPending: boolean) {
    const { D, S } = await core();
    const { buildXlsx }: any = await import("@/lib/core/xlsx-lite.js");
    const ob = await D.db.outbox.toArray();
    const pend = new Map<string, any>(ob.map((o: any) => [o.key, o]));
    const sheet = async (tbl: string, name: string) => {
      const cols: string[] = S.EXPORT_COLS[tbl];
      const rows = (await D.db[tbl].toArray()).filter((r: any) => !onlyPending || pend.has(`${tbl}:${r.id}`))
        .sort((a: any, b: any) => String(a.hole_id).localeCompare(String(b.hole_id)) || String(a.work_date || "").localeCompare(String(b.work_date || "")));
      return { name, header: [...cols, "status_kirim", "error"], rows: rows.map((r: any) => { const o = pend.get(`${tbl}:${r.id}`); return [...cols.map(c => r[c] ?? null), o ? (o.err ? "error" : "pending") : "synced", o?.err || ""]; }) };
    };
    const [c, p, h] = [await sheet("collars", "Collar"), await sheet("progress", "Progress"), await sheet("disthours", "Jam rig")];
    const extra = (await Promise.all([["surveys", "Survey"], ["samples", "Sample"], ["assays", "Assay"]].map(([t, nm]) => sheet(t, nm)))).filter(x => x.rows.length);
    if (!c.rows.length && !p.rows.length && !h.rows.length && !extra.length) return toast(onlyPending ? "Tidak ada data yang belum terkirim." : "Belum ada data di HP.", "err");
    const stamp = new Date().toLocaleString("sv-SE").replace(/[-:]/g, "").replace(" ", "-").slice(0, 13);
    const meta = { name: "Info", header: ["item", "nilai"], rows: [["Site", info.site], ["Pengguna", info.guest ? "(belum login)" : `${info.name} <${info.email}>`], ["Diekspor", new Date().toISOString()], ["Isi", onlyPending ? "Hanya data yang belum terkirim" : "Semua data di HP"], ["Kode perangkat", deviceCode()]] };
    const blob = new Blob([buildXlsx([c, p, h, ...extra, meta])], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    save(blob, `exploration_${info.site}_${onlyPending ? "belum-terkirim" : "semua"}_${stamp}.xlsx`);
    toast("File Excel diunduh");
  }

  async function exportPhotos() {
    const { D, S } = await core();
    const { makeZip }: any = await import("@/lib/core/zip.js");
    const keep = (k: string) => (shown.current[k] ? new Set(shown.current[k].map(r => r.id)) : null);
    const kc = keep("collars"), kp = keep("progress");
    const items = [...(await D.db.collars.toArray()).filter((r: any) => !kc || kc.has(r.id)), ...(await D.db.progress.toArray()).filter((r: any) => !kp || kp.has(r.id))]
      .filter((r: any) => !r.deleted_at && !r.is_deleted && r.photo_path);
    if (!items.length) { setPhotoMsg("Tidak ada foto yang cocok."); return; }
    setPhotoBusy(true);
    const files: { name: string; blob: Blob }[] = []; let miss = 0, i = 0;
    for (const r of items) {
      setPhotoMsg(`Menyiapkan foto ${++i} / ${items.length}…`);
      let blob = (await D.db.photos.get(r.id))?.blob;
      if (!blob && navigator.onLine) { try { const u = await S.signedPhotoUrl(r.photo_path); const res = u && await fetch(u); if (res?.ok) blob = await res.blob(); } catch { /* counted as missing */ } }
      if (blob) files.push({ name: r.photo_path, blob }); else miss++;
    }
    if (!files.length) { setPhotoMsg("Foto tidak bisa diambil (offline atau belum terkirim)."); setPhotoBusy(false); return; }
    const seen = new Set<string>(); for (const f of files) { while (seen.has(f.name)) f.name = f.name.replace(/(\.jpg)?$/, "_2.jpg"); seen.add(f.name); }
    save(await makeZip(files), `foto_${info.site}_${new Date().toISOString().slice(0, 10)}.zip`);
    setPhotoMsg(`${files.length} foto diunduh${miss ? `, ${miss} tidak tersedia (offline/belum terkirim)` : ""}.`); setPhotoBusy(false);
  }

  return (
    <div className="enter flex flex-col gap-5">
      <Card id="dr-head">
        <CardTitle>Data Records</CardTitle>
        <p className="text-sm text-muted-foreground">Data di HP ini: collar {n("collars")}, progress {n("progress")}, jam rig {n("disthours")}{n("surveys") || n("samples") || n("assays") ? `, survey ${n("surveys")}, sample ${n("samples")}, assay ${n("assays")}` : ""}. Termasuk data dari server setelah login dan sinkron. Tiap daftar bisa dilipat, dicari, difilter per kolom, dan diurutkan dengan mengetuk judul kolom.</p>
      </Card>
      <RecordList id="d:all" title="Semua data" rows={d.comb} cols={d.combCols} sort={{ k: "date", dir: -1 }} open
        onOpen={r => open(r._tbl, r.id)} canOpen={r => canOpenTbl(r._tbl)} />
      {TABLES.map(t => (
        <RecordList key={t} id={`d:${t}`} title={FORM_LAB[t]} rows={d.byTbl[t]} cols={d.cols[t]} sort={SORTS[t]} open={false}
          onShown={r => { shown.current[t] = r; }} onOpen={opener(t)} canOpen={() => canOpenTbl(t)} />
      ))}
      <Card id="x-excel">
        <CardTitle>Backup ke Excel</CardTitle>
        <p className="text-sm text-muted-foreground">Salinan data di HP sebagai file .xlsx. Simpan atau kirim ke site admin bila lama tidak ada internet. Foto tidak ikut; foto tetap di HP sampai terkirim.</p>
        <div className="flex flex-wrap gap-3">
          <Button id="x-pend" disabled={!d.pending} onClick={() => exportExcel(true)}><Download />Unduh yang belum terkirim ({d.pending})</Button>
          <Button id="x-all" variant="outline" onClick={() => exportExcel(false)}><Download />Unduh semua</Button>
        </div>
      </Card>
      <Card id="x-photos">
        <CardTitle>Backup foto (zip)</CardTitle>
        <p className="text-sm text-muted-foreground">Semua foto collar dan core dalam satu file .zip (folder collar/ dan core/). Ikut filter di daftar Drilling Progress dan Collar di atas. Foto yang hanya ada di server diunduh dulu, jadi perlu internet.</p>
        <div className="flex flex-wrap gap-3"><Button id="x-photo" disabled={photoBusy} onClick={exportPhotos}><FileArchive />Unduh foto (.zip)</Button></div>
        <p className="text-xs text-muted-foreground" id="x-photo-msg">{photoMsg}</p>
      </Card>
    </div>
  );
}
