"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { core, canForm, type Info } from "@/lib/boot";
import { takeEditing, FORM_OF } from "@/lib/editing";
import { decorated, makeCols } from "@/lib/rec-cols";
import { useToast } from "./toast";
import { useConfirm } from "./confirm";
import { Button } from "./ui/button";
import { Input, Select, Textarea } from "./ui/input";
import { Card, CardTitle } from "./ui/card";
import { Field, FormActions, Msgs, today, num, txt, s } from "./form-kit";
import { RecordList, type Col } from "./record-list";

type F = { sample_no: string; hole_id: string; from_m: string; to_m: string; sample_type: string; status: string; sampled_date: string; sent_date: string; lab: string; batch_id: string; remarks: string; step: string };
const sUi = { hole: "", sel: new Set<string>() };   // survives tab switches
const rnd = (x: number) => Math.round(x * 100) / 100;

const nextSampleNo = (list: any[]) => {
  const lastRec = [...list].filter(x => /\d+$/.test(x.sample_no || "")).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
  if (!lastRec) return "";
  const m = /^(.*?)(\d+)$/.exec(lastRec.sample_no)!;
  return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, "0");
};

export function SampleForm({ info, tick }: { info: Info; tick?: string }) {
  const toast = useToast(), ask = useConfirm();
  const [ready, setReady] = useState(false);
  const [d, setD] = useState<{ collars: any[]; prog: any[]; all: any[]; types: any[]; stats: any[]; cols: Col[]; rows: any[] }>({ collars: [], prog: [], all: [], types: [], stats: [], cols: [], rows: [] });
  const [rec, setRec] = useState<any | null>(null);
  const [f, setF] = useState<F>({ sample_no: "", hole_id: "", from_m: "", to_m: "", sample_type: "", status: "", sampled_date: today(), sent_date: "", lab: "", batch_id: "", remarks: "", step: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [warns, setWarns] = useState<string[]>([]);
  const [, bump] = useState(0);
  const [bulk, setBulk] = useState({ date: today(), lab: "", batch: "" });
  const shownRef = useRef<any[]>([]);
  const isEdit = !!rec;

  const lastTo = (all: any[], h: string) => Math.max(0, ...all.filter(x => x.hole_id === h && x.sample_type === "NORMAL").map(x => Number(x.to_m)));

  const load = useCallback(async () => {
    const { D, cfg, V } = await core();
    const [collars, prog, all] = await Promise.all([D.db.collars.filter((c: any) => !c.is_deleted).toArray(), D.db.progress.filter((p: any) => !p.is_deleted).toArray(), D.db.samples.filter((x: any) => !x.is_deleted).toArray()]);
    const cols = makeCols(cfg, V).samples;
    const rows = await decorated(D, "samples", all);
    setD({ collars, prog, all, types: cfg.codes("sample_type"), stats: cfg.codes("sample_status"), cols, rows });
    return { all, type: cfg.codes("sample_type")[0]?.code || "NORMAL", status: cfg.codes("sample_status")[0]?.code || "PENDING" };
  }, []);

  const fresh = (x: { all: any[]; type: string; status: string }): F => ({
    sample_no: nextSampleNo(x.all), hole_id: sUi.hole, from_m: sUi.hole ? String(lastTo(x.all, sUi.hole) || "") : "", to_m: "", sample_type: x.type, status: x.status,
    sampled_date: today(), sent_date: "", lab: "", batch_id: "", remarks: "", step: "",
  });
  const toForm = (r: any): F => ({ sample_no: r.sample_no ?? "", hole_id: r.hole_id ?? "", from_m: s(r.from_m), to_m: s(r.to_m), sample_type: r.sample_type ?? "", status: r.status ?? "", sampled_date: r.sampled_date ?? "", sent_date: r.sent_date ?? "",
    lab: r.lab ?? "", batch_id: r.batch_id ?? "", remarks: r.remarks ?? "", step: "" });

  useEffect(() => {
    (async () => {
      const x = await load();
      const pend = takeEditing("samples");
      if (pend) { setRec(pend); setF(toForm(pend)); } else setF(fresh(x));
      setReady(true);
    })();
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready) load(); }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof F>(k: K, v: F[K]) => setF(p => ({ ...p, [k]: v }));
  const hid = f.hole_id.trim().toUpperCase();

  const build = (): any => ({
    ...(rec ?? { id: crypto.randomUUID(), is_deleted: false }), sample_no: f.sample_no.trim(), hole_id: hid, from_m: num(f.from_m), to_m: num(f.to_m), sample_type: f.sample_type, status: f.status,
    sampled_date: f.sampled_date || null, sent_date: f.sent_date || null, lab: txt(f.lab), batch_id: txt(f.batch_id), remarks: txt(f.remarks),
  });
  const ctx = (r: any, siblings = d.all) => {
    const collar = d.collars.find(c => c.hole_id === r.hole_id), pr = d.prog.filter(p => p.hole_id === r.hole_id);
    return { collar, siblings, deepest: pr.length ? Math.max(...pr.map(p => Number(p.to_m))) : null };
  };
  const cur = build(), c0 = ctx(cur);
  const len = cur.from_m != null && cur.to_m != null && cur.to_m > cur.from_m ? rnd(cur.to_m - cur.from_m) : "";
  const mine = d.all.filter(x => x.hole_id === hid);

  async function reset() { setRec(null); setErrors([]); setWarns([]); const x = await load(); setF(fresh(x)); }

  async function save(force = false) {
    const { D, V, S } = await core();
    const r = build(), v = V.validateSample(r, ctx(r));
    setErrors(v.errors); setWarns(v.warns);
    if (v.errors.length) return;
    if (v.warns.length && !force) return;
    await D.saveRecord("samples", r);
    sUi.hole = r.hole_id; toast("Tersimpan di perangkat"); S.syncSoon(); await reset();
  }
  async function remove() {
    if (!await ask("Hapus sampel ini?", { title: "Hapus data?", ok: "Hapus", danger: true })) return;
    const { D, S } = await core();
    await D.saveRecord("samples", { ...build(), is_deleted: true });
    toast("Dihapus"); S.syncSoon(); await reset();
  }

  async function split() {
    const { D, V, S } = await core();
    const r = build(), step = num(f.step), m = /^(.*?)(\d+)$/.exec(r.sample_no || "");
    const errs: string[] = [];
    if (!step || step <= 0) errs.push('Isi "Pecah per (m)".');
    if (!m) errs.push("Nomor sampel harus berakhir angka agar bisa dilanjutkan (mis. CDSM-0001).");
    if (r.from_m == null || r.to_m == null || r.to_m <= r.from_m) errs.push("Isi Dari dan Sampai yang valid.");
    if (errs.length) { setErrors(errs); setWarns([]); return; }
    const recs: any[] = []; let a = r.from_m, n = Number(m![2]);
    while (a < r.to_m - 1e-9) {
      const b = Math.min(rnd(a + step!), r.to_m);
      recs.push({ ...r, id: crypto.randomUUID(), sample_no: m![1] + String(n++).padStart(m![2].length, "0"), from_m: rnd(a), to_m: b }); a = b;
    }
    if (recs.length > 500) { setErrors(["Maksimal 500 sampel sekali pecah."]); setWarns([]); return; }
    const pool = [...d.all], errors: string[] = [], warnsAll: string[] = [];
    for (const x of recs) { const v = V.validateSample(x, ctx(x, pool)); errors.push(...v.errors.map((e: string) => `${x.sample_no}: ${e}`)); warnsAll.push(...v.warns); pool.push(x); }
    setErrors(errors.slice(0, 5).concat(errors.length > 5 ? [`… dan ${errors.length - 5} error lain`] : [])); setWarns([...new Set(warnsAll)]);
    if (errors.length) return;
    if (!await ask(`Simpan ${recs.length} sampel: ${recs[0].sample_no} … ${recs[recs.length - 1].sample_no} (${r.from_m}–${r.to_m} m, per ${step} m)?`, { title: "Konfirmasi", ok: "Simpan" })) return;
    await D.saveMany("samples", recs);
    sUi.hole = r.hole_id; toast(`${recs.length} sampel tersimpan di perangkat`); S.syncSoon(); await reset();
  }

  async function setStatus(st: string) {
    const ids = [...sUi.sel].filter(id => d.all.some(x => x.id === id));
    if (!ids.length) return toast("Centang sampel dulu.", "err");
    const { D, S } = await core();
    const recs = ids.map(id => {
      const x = d.all.find(y => y.id === id), n = { ...x, status: st };
      if (st === "SENT") { n.sent_date = bulk.date || today(); if (bulk.lab.trim()) n.lab = bulk.lab.trim(); if (bulk.batch.trim()) n.batch_id = bulk.batch.trim(); if (n.sampled_date && n.sent_date < n.sampled_date) n.sent_date = n.sampled_date; }
      if (st === "PENDING") n.sent_date = null;
      return n;
    });
    await D.saveMany("samples", recs); sUi.sel.clear(); toast(`${recs.length} sampel diperbarui`); S.syncSoon(); await load(); bump(x => x + 1);
  }

  if (!ready) return <div className="text-sm text-muted-foreground" aria-busy>Memuat…</div>;
  const holes = [...new Set([...d.collars.map(c => c.hole_id), ...d.prog.map(p => p.hole_id)])].sort();
  const can = (c: string) => d.stats.some((x: any) => x.code === c);

  return (
    <div className="enter flex flex-col gap-5">
      <form onSubmit={e => { e.preventDefault(); save(); }} autoComplete="off" id="f" style={{ ["--i" as string]: 0 }}>
        <Card>
          <CardTitle>{isEdit ? "Edit" : "Register"} sampel</CardTitle>
          <Field label="Hole ID">
            <Input name="hole_id" list="sholes" required autoCapitalize="characters" value={f.hole_id}
              onChange={e => set("hole_id", e.target.value)}
              onBlur={() => { sUi.hole = hid; if (!isEdit && f.from_m === "") set("from_m", String(lastTo(d.all, hid) || "")); }} />
            <datalist id="sholes">{holes.map(h => <option key={h} value={h} />)}</datalist>
          </Field>
          <div id="sinfo" className="-mt-2 min-h-4 text-xs text-muted-foreground">{hid ? `Dibor sampai ${c0.deepest ?? "—"} m · sampel terdaftar ${mine.length}${mine.length ? ` (sampai ${lastTo(d.all, hid)} m)` : ""}` : ""}</div>
          <Field label="Nomor sampel"><Input name="sample_no" required autoCapitalize="characters" value={f.sample_no} onChange={e => set("sample_no", e.target.value)} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Dari (m)"><Input name="from_m" type="number" step="0.01" inputMode="decimal" required value={f.from_m} onChange={e => set("from_m", e.target.value)} /></Field>
            <Field label="Sampai (m)"><Input name="to_m" type="number" step="0.01" inputMode="decimal" required value={f.to_m} onChange={e => set("to_m", e.target.value)} /></Field>
            <Field label="Panjang"><Input name="len" readOnly value={String(len)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipe"><Select name="sample_type" value={f.sample_type} onChange={e => set("sample_type", e.target.value)}>{d.types.map((t: any) => <option key={t.code} value={t.code}>{t.label}</option>)}{f.sample_type && !d.types.some((t: any) => t.code === f.sample_type) && <option value={f.sample_type}>{f.sample_type}</option>}</Select></Field>
            <Field label="Status"><Select name="status" value={f.status} onChange={e => set("status", e.target.value)}>{d.stats.map((t: any) => <option key={t.code} value={t.code}>{t.label}</option>)}{f.status && !d.stats.some((t: any) => t.code === f.status) && <option value={f.status}>{f.status}</option>}</Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal ambil"><Input name="sampled_date" type="date" value={f.sampled_date} onChange={e => set("sampled_date", e.target.value)} /></Field>
            <Field label="Tanggal kirim"><Input name="sent_date" type="date" value={f.sent_date} onChange={e => set("sent_date", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lab"><Input name="lab" value={f.lab} onChange={e => set("lab", e.target.value)} /></Field>
            <Field label="Batch"><Input name="batch_id" value={f.batch_id} onChange={e => set("batch_id", e.target.value)} /></Field>
          </div>
          <Field label="Remarks"><Textarea name="remarks" rows={2} value={f.remarks} onChange={e => set("remarks", e.target.value)} /></Field>
          {!isEdit && (
            <>
              <Field label="Pecah per (m)" hint="Isi Dari dan Sampai, lalu Pecah per. Nomor berlanjut dari nomor di atas (harus berakhir angka). Potongan terakhir boleh lebih pendek."><Input name="step" type="number" step="0.01" min="0.05" inputMode="decimal" placeholder="mis. 1" value={f.step} onChange={e => set("step", e.target.value)} /></Field>
              <Button type="button" variant="outline" className="w-fit" onClick={split} id="b-split">Simpan sebagai banyak sampel</Button>
            </>
          )}
          <Msgs errors={errors} warns={warns} />
          <FormActions isEdit={isEdit} onCancel={reset} onDelete={remove} warnMode={!!warns.length && !errors.length} onForce={() => save(true)} />
        </Card>
      </form>

      <Card id="slist" style={{ ["--i" as string]: 1 }}>
        <CardTitle>Ubah status terpilih</CardTitle>
        <p className="text-sm text-muted-foreground">Centang sampel di daftar. <Button type="button" variant="outline" size="sm" id="s-all" onClick={() => { shownRef.current.forEach(x => sUi.sel.add(x.id)); bump(x => x + 1); }}>Pilih semua yang tampil</Button> <Button type="button" variant="outline" size="sm" id="s-none" onClick={() => { sUi.sel.clear(); bump(x => x + 1); }}>Kosongkan</Button> · terpilih <b id="s-n">{sUi.sel.size}</b></p>
        <Field label="Tanggal kirim"><Input type="date" name="b_date" value={bulk.date} onChange={e => setBulk(b => ({ ...b, date: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Lab"><Input id="b-lab" value={bulk.lab} onChange={e => setBulk(b => ({ ...b, lab: e.target.value }))} /></Field><Field label="Batch"><Input id="b-batch" value={bulk.batch} onChange={e => setBulk(b => ({ ...b, batch: e.target.value }))} /></Field></div>
        <div className="flex flex-wrap gap-3">
          {can("SENT") && <Button type="button" onClick={() => setStatus("SENT")} data-set="SENT">Tandai terkirim ke lab</Button>}
          {can("ANALYZED") && <Button type="button" variant="outline" onClick={() => setStatus("ANALYZED")} data-set="ANALYZED">Tandai sudah dianalisis</Button>}
          {can("PENDING") && <Button type="button" variant="outline" onClick={() => setStatus("PENDING")} data-set="PENDING">Kembalikan ke belum dikirim</Button>}
        </div>
      </Card>

      <RecordList id="f:samples" title="Daftar sampel" rows={d.rows} cols={d.cols} sort={{ k: "hole_id", dir: 1 }}
        onShown={r => { shownRef.current = r; }}
        select={{ set: sUi.sel, id: r => r.id, onChange: () => bump(x => x + 1) }}
        onOpen={r => { const x = d.all.find(y => y.id === r.id); if (x) { setRec(x); setF(toForm(x)); setErrors([]); setWarns([]); window.scrollTo({ top: 0, behavior: "smooth" }); } }}
        canOpen={() => canForm(info, FORM_OF.samples)} />
    </div>
  );
}
