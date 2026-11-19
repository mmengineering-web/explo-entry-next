"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Camera, Compass, Image as ImageIcon } from "lucide-react";
import { core, type Info } from "@/lib/boot";
import { useToast } from "./toast";
import { Button } from "./ui/button";
import { Input, Select, Textarea } from "./ui/input";
import { Card, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";

type Rec = {
  id: string; work_date: string; shift: string; rig_id: string; hole_id: string; from_m: number | null; to_m: number | null;
  downtime_hours: number; downtime_reason: string; core_len_m: number | null; remarks: string; photo_path: string | null; layer: string; is_deleted: boolean;
  [k: string]: any;
};
type Form = { work_date: string; shift: string; rig_id: string; hole_id: string; from_m: string; to_m: string; layer: string; core_len_m: string;
  downtime_hours: string; downtime_reason: string; remarks: string; eoh: boolean };

const today = () => new Date().toLocaleDateString("sv-SE");
const num = (v: string) => (v === "" || isNaN(Number(v)) ? null : Number(v));
const txt = (v: string) => (v.trim() === "" ? null : v.trim());
const fm = (n: number) => String(Math.round(n * 100) / 100);
const mnum = (x: number | null) => (x == null || isNaN(x) ? "" : String(Math.round(x * 100) / 100));

function blank(shift: string, rig: string): Form {
  return { work_date: today(), shift, rig_id: rig, hole_id: "", from_m: "", to_m: "", layer: "", core_len_m: "", downtime_hours: "0", downtime_reason: "", remarks: "", eoh: false };
}
function toForm(r: Rec): Form {
  return { work_date: r.work_date, shift: r.shift ?? "", rig_id: r.rig_id ?? "", hole_id: r.hole_id ?? "", from_m: r.from_m == null ? "" : String(r.from_m), to_m: r.to_m == null ? "" : String(r.to_m),
    layer: r.layer ?? "", core_len_m: r.core_len_m == null ? "" : String(r.core_len_m), downtime_hours: String(r.downtime_hours ?? 0), downtime_reason: r.downtime_reason ?? "", remarks: r.remarks ?? "", eoh: false };
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={cn("flex min-w-0 flex-col gap-1.5 text-sm font-medium", className)}><span className="lbl">{label}</span>{children}</label>;
}

// A rule-driven block: collapses with a grid-row transition and becomes inert when closed (values are never cleared).
function Dyn({ open, children, id }: { open: boolean; children: React.ReactNode; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = ref.current; if (!el) return; (el as any).inert = !open; }, [open]);
  return <div ref={ref} id={id} className="dyn" data-open={open} aria-hidden={!open}><div className="dyn-in"><div className="flex flex-col gap-4 pb-px">{children}</div></div></div>;
}

export function ProgressForm({ info, tick }: { info: Info; tick?: string }) {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<{ rigs: any[]; collars: any[]; collarsAll: any[]; prog: any[]; shifts: any[]; layers: any[]; reasons: any[]; maxDt: number }>({ rigs: [], collars: [], collarsAll: [], prog: [], shifts: [], layers: [], reasons: [], maxDt: 12 });
  const [rec, setRec] = useState<Rec | null>(null);
  const [f, setF] = useState<Form>(blank("", ""));
  const [autoFrom, setAutoFrom] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warns, setWarns] = useState<string[]>([]);
  const lastHole = useRef("");
  const isEdit = !!rec;

  const load = useCallback(async () => {
    const { D, cfg } = await core();
    const [rigs, collarsAll, prog] = await Promise.all([D.db.rigs.toArray(), D.db.collars.filter((c: any) => !c.is_deleted).toArray(), D.db.progress.filter((p: any) => !p.is_deleted).toArray()]);
    const collars = collarsAll.filter((c: any) => !cfg.metaOf("collar_status", c.status).hide_from_progress);
    setData({ rigs, collars, collarsAll, prog, shifts: cfg.codes("shift"), layers: cfg.codes("layer"), reasons: cfg.codes("downtime_reason"), maxDt: cfg.setting("shift_hours") });
    return { shift: cfg.codes("shift")[0]?.code || "" };
  }, []);

  useEffect(() => {
    (async () => {
      const { shift } = await load();
      setF(blank(shift, localStorage.getItem("exp_last_rig") || ""));
      setReady(true);
    })();
  }, [load]);

  // reference data and records arrive after a sync: refresh the lists without touching what is typed
  useEffect(() => { if (ready) load(); }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(p => ({ ...p, [k]: v }));
  const hid = f.hole_id.trim().toUpperCase();
  const collar = useMemo(() => data.collarsAll.find(c => c.hole_id === hid), [data.collarsAll, hid]);

  const others = useMemo(() => data.prog.filter(p => p.hole_id === hid && p.id !== rec?.id && p.to_m != null), [data.prog, hid, rec]);
  const prevDepth = others.length ? Math.max(0, ...others.map(p => p.to_m)) : 0;

  // a new interval continues where the hole stopped: From is filled once per hole change, and typing wins
  useEffect(() => {
    if (isEdit || hid === lastHole.current) return;
    lastHole.current = hid;
    if (others.length && (f.from_m === "" || autoFrom)) { setF(p => ({ ...p, from_m: fm(prevDepth) })); setAutoFrom(true); }
    else if (autoFrom) { setF(p => ({ ...p, from_m: "" })); setAutoFrom(false); }
  }, [hid]); // eslint-disable-line react-hooks/exhaustive-deps

  const from = num(f.from_m), to = num(f.to_m), coreLen = num(f.core_len_m);
  const meters = from != null && to != null ? to - from : null;
  const deepest = Math.max(0, ...data.prog.filter(p => p.hole_id === hid && p.id !== rec?.id).map(p => p.to_m ?? 0), to ?? 0);
  const planned = Number(collar?.planned_depth_m) > 0 ? Number(collar.planned_depth_m) : Number(collar?.total_depth_m) > 0 ? Number(collar.total_depth_m) : 0;
  const recovery = coreLen != null && meters && meters > 0 ? (coreLen / meters) * 100 : null;
  const photoName = hid && from != null && to != null ? `${hid}_${mnum(from)}_${mnum(to)}` : "";

  // dynamic rules (js/forms/defs.js): shared evaluator, same JSON shape that will live in Supabase later
  const [rules, setRules] = useState<{ core: boolean; reasonReq: boolean }>({ core: true, reasonReq: false });
  useEffect(() => {
    core().then(({ R, defs, cfg }) => {
      const get = (k: string) => (k === "hole_id" ? hid : (f as any)[k] ?? "");
      const preds = {
        holeUnknown: (g: any) => !String(g("hole_id")).trim() || !data.collarsAll.some(c => c.hole_id === String(g("hole_id")).trim().toUpperCase()),
        isCoring: (g: any) => { const c = data.collarsAll.find(x => x.hole_id === String(g("hole_id")).trim().toUpperCase()); return !!c && !!cfg.metaOf("hole_type", c.hole_type).is_coring; },
      };
      const gf = (k: string) => (k === "core_len_m" ? f.core_len_m : k === "downtime_hours" ? f.downtime_hours : get(k));
      const [coreRule, reasonRule] = defs.progressRules;
      setRules({ core: R.evalCond(coreRule.showIf, gf, preds), reasonReq: R.evalCond(reasonRule.requiredIf, gf, preds) });
    });
  }, [f, hid, data.collarsAll]);

  function pickPhoto(file?: File) {
    if (!file) return;
    core().then(async ({ cfg }) => {
      try {
        const px = cfg.setting("photo_max_px");
        const bmp = await createImageBitmap(file);
        const k = Math.min(1, px / Math.max(bmp.width, bmp.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
        cv.getContext("2d")!.drawImage(bmp, 0, 0, cv.width, cv.height);
        const blob: Blob | null = await new Promise(res => cv.toBlob(res, "image/jpeg", 0.8));
        if (!blob) throw new Error("x");
        if (photoUrl) URL.revokeObjectURL(photoUrl);
        setPhoto(blob); setPhotoUrl(URL.createObjectURL(blob));
      } catch { toast("Gagal memproses foto", "err"); }
    });
  }

  const build = (): Rec => ({
    ...(rec ?? { id: crypto.randomUUID(), photo_path: null, is_deleted: false }),
    work_date: f.work_date, shift: f.shift, rig_id: f.rig_id.trim(), hole_id: hid, from_m: from, to_m: to,
    downtime_hours: num(f.downtime_hours) ?? 0, downtime_reason: txt(f.downtime_reason) ?? "", layer: txt(f.layer) ?? "", core_len_m: coreLen, remarks: txt(f.remarks) ?? "",
  } as Rec);

  async function save(force = false) {
    const { D, V, S, cfg } = await core();
    const r = build();
    const siblings = r.hole_id ? await D.db.progress.where("hole_id").equals(r.hole_id).toArray() : [];
    const v = V.validateProgress(r, { collar, siblings });
    setErrors(v.errors); setWarns(v.warns);
    if (v.errors.length) return;
    if (v.warns.length && !force) return;            // second tap on "Tetap simpan" confirms
    const nm = photoName;
    if (photo) { r.photo_path = `core/${nm}.jpg`; await D.db.photos.put({ id: r.id, blob: photo, uploaded: false }); }
    else if (r.photo_path && r.photo_path !== `core/${nm}.jpg`) {
      const ph = await D.db.photos.get(r.id);
      if (ph?.blob) { r.photo_path = `core/${nm}.jpg`; await D.db.photos.put({ id: r.id, blob: ph.blob, uploaded: false }); }
    }
    await D.saveRecord("progress", r);
    // collar follows progress: first interval -> Drilling, EOH ticked -> Completed with total depth = Sampai
    let note = "";
    const cl = data.collarsAll.find(x => x.hole_id === r.hole_id);
    if (cl) {
      const cls = (code: string) => { const m = cfg.metaOf("collar_status", code); return m.map_class === "planned" || (!m.map_class && m.is_plan) ? "planned" : m.map_class === "progress" ? "coh" : m.map_class || "coh"; };
      const want = f.eoh ? "eoh" : cls(cl.status) === "planned" ? "coh" : null;
      const code = want && cfg.codes("collar_status").find((x: any) => cls(x.code) === want)?.code;
      if (code && cl.status !== code) {
        await D.saveRecord("collars", { ...cl, status: code, total_depth_m: want === "eoh" ? r.to_m : cl.total_depth_m });
        if (cl.asbuilt_lat == null) note = ` Status collar jadi ${cfg.labelOf("collar_status", code)}; lengkapi koordinat as-built di tab Collar.`;
      } else if (want === "eoh" && code && Number(cl.total_depth_m) !== Number(r.to_m)) await D.saveRecord("collars", { ...cl, total_depth_m: r.to_m });
    }
    if (r.rig_id) localStorage.setItem("exp_last_rig", r.rig_id);
    toast("Tersimpan di perangkat" + note);
    S.syncSoon();
    setRec(null); setPhoto(null); setPhotoUrl(null); setErrors([]); setWarns([]); setAutoFrom(false); lastHole.current = "";
    const { shift } = await load();
    setF(blank(shift, r.rig_id));
  }

  async function remove() {
    if (!rec) return;
    const { D, S } = await core();
    await D.saveRecord("progress", { ...build(), is_deleted: true });
    toast("Dihapus"); S.syncSoon(); cancel(); load();
  }
  function cancel() { setRec(null); setPhoto(null); setPhotoUrl(null); setErrors([]); setWarns([]); lastHole.current = ""; load().then(({ shift }) => setF(blank(shift, localStorage.getItem("exp_last_rig") || ""))); }
  function edit(r: Rec) { setRec(r); setF(toForm(r)); lastHole.current = r.hole_id; setAutoFrom(false); window.scrollTo({ top: 0, behavior: "smooth" }); }

  if (!ready) return <div className="text-sm text-muted-foreground" aria-busy>Memuat…</div>;

  const left = planned - Math.max(prevDepth, to ?? 0);
  const rows = [...data.prog].sort((a, b) => (b.work_date || "").localeCompare(a.work_date || "") || (b.updated_at || "").localeCompare(a.updated_at || "")).slice(0, 25);
  const holeList = [...new Set([...data.collars.map(c => c.hole_id), ...data.prog.map(p => p.hole_id)])];

  return (
    <div className="enter flex flex-col gap-5">
      <form onSubmit={e => { e.preventDefault(); save(); }} autoComplete="off" id="f" style={{ ["--i" as string]: 0 }}>
        <Card>
          <CardTitle>{isEdit ? "Edit" : "Input"} drilling progress</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal"><Input name="work_date" type="date" required value={f.work_date} onChange={e => set("work_date", e.target.value)} /></Field>
            <Field label="Shift"><Select name="shift" value={f.shift} onChange={e => set("shift", e.target.value)}>{data.shifts.map((s: any) => <option key={s.code} value={s.code}>{s.label}</option>)}</Select></Field>
          </div>
          <Field label="Rig">
            {data.rigs.length ? (
              <Select name="rig_id" required value={f.rig_id} onChange={e => set("rig_id", e.target.value)}><option value="">— pilih —</option>{data.rigs.map((r: any) => <option key={r.rig_id} value={r.rig_id}>{r.rig_name || r.rig_id}</option>)}</Select>
            ) : (
              <><Input name="rig_id" required autoCapitalize="characters" placeholder="mis. RIG-01" value={f.rig_id} onChange={e => set("rig_id", e.target.value)} />
                <span className="text-xs font-normal text-muted-foreground">Daftar rig belum tersedia di HP ini (belum pernah login). Ketik ID rig.</span></>
            )}
          </Field>
          <Field label="Hole ID">
            <Input name="hole_id" list="holes" autoCapitalize="characters" required value={f.hole_id} onChange={e => set("hole_id", e.target.value)} />
            <datalist id="holes">{holeList.map(h => <option key={h} value={h} />)}</datalist>
            <span className="min-h-4 text-xs font-normal text-muted-foreground" id="holeinfo">{collar ? `${collar.hole_type ?? ""} · ${collar.prospect || "—"} · planned ${collar.planned_depth_m ?? "—"} m · total ${collar.total_depth_m ?? "—"} m` : ""}</span>
          </Field>

          {planned > 0 && hid && (
            <div id="depth" className="-mt-1">
              <div className="relative h-[.7rem] overflow-hidden rounded-full border bg-primary" role="img" aria-label="Kedalaman terbor terhadap rencana">
                <motion.i className="absolute inset-y-0 right-0 bg-muted" initial={false} animate={{ left: `${Math.min(100, Math.max(0, (Math.max(prevDepth, to ?? 0) / planned) * 100))}%` }} transition={{ type: "spring", stiffness: 160, damping: 22 }} />
                {to != null && to > (from ?? prevDepth) && (
                  <motion.i className="absolute -inset-y-px min-w-[.35rem] rounded-full border-2 border-foreground bg-[color-mix(in_srgb,var(--background)_35%,transparent)]" initial={false}
                    animate={{ left: `${Math.min(100, ((from ?? prevDepth) / planned) * 100)}%`, width: `${Math.max(1.2, Math.min(100, (to / planned) * 100) - Math.min(100, ((from ?? prevDepth) / planned) * 100))}%` }} transition={{ type: "spring", stiffness: 200, damping: 24 }} />
                )}
              </div>
              <div className="mt-1.5 flex justify-between text-xs tabular-nums text-muted-foreground" id="depth-l"><span id="depth-a">Terbor <b className="font-semibold text-foreground">{fm(Math.max(prevDepth, to ?? 0))}</b> dari {fm(planned)} m</span><span id="depth-b">{left >= 0 ? `Sisa ${fm(left)} m` : `Lewat rencana ${fm(-left)} m`}</span></div>
            </div>
          )}

          <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="eoh" className="size-5 accent-[var(--primary)]" checked={f.eoh} onChange={e => set("eoh", e.target.checked)} />End of hole (EOH): lubang selesai</label>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Dari (m)">
              <motion.div key={f.from_m + String(autoFrom)} initial={autoFrom ? { backgroundColor: "color-mix(in srgb, var(--primary) 18%, transparent)" } : false} animate={{ backgroundColor: "rgba(0,0,0,0)" }} transition={{ duration: 0.9 }} className="rounded-md">
                <Input name="from_m" type="number" step="0.01" inputMode="decimal" required value={f.from_m} onChange={e => { setAutoFrom(false); set("from_m", e.target.value); }} />
              </motion.div>
              {autoFrom && <span className="flex items-center gap-1.5 text-xs font-normal text-brand" id="from-hint"><Compass className="size-3.5" />Lanjut dari kedalaman terakhir</span>}
            </Field>
            <Field label="Sampai (m)"><Input name="to_m" type="number" step="0.01" inputMode="decimal" required value={f.to_m} onChange={e => set("to_m", e.target.value)} /></Field>
            <Field label="Meter"><Input name="meters" readOnly value={meters != null ? meters.toFixed(2) : ""} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Rencana (m)"><Input name="plan_m" readOnly placeholder="dari collar" value={collar?.planned_depth_m ?? ""} /></Field>
            <Field label="Capaian (m)"><Input name="ach_m" readOnly value={hid ? deepest.toFixed(2) : ""} /></Field>
            <Field label="Capaian (%)"><Input name="ach_pct" readOnly value={collar?.planned_depth_m > 0 && hid ? ((deepest / collar.planned_depth_m) * 100).toFixed(1) : ""} /></Field>
          </div>
          <Field label="Layer"><Select name="layer" value={f.layer} onChange={e => set("layer", e.target.value)}><option value="">—</option>{data.layers.map((l: any) => <option key={l.code} value={l.code}>{l.label}</option>)}</Select></Field>

          <Dyn open={rules.core} id="corebox">
            <fieldset className="flex flex-col gap-3 rounded-lg border p-3"><legend className="px-1 text-sm font-semibold text-brand">Core result</legend>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Core length (m)"><Input name="core_len_m" type="number" step="0.01" min="0" inputMode="decimal" value={f.core_len_m} onChange={e => set("core_len_m", e.target.value)} /></Field>
                <Field label="Recovery (%)"><Input name="core_rec" readOnly value={recovery != null ? recovery.toFixed(1) : ""} /></Field>
              </div>
            </fieldset>
          </Dyn>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Downtime (jam)"><Input name="downtime_hours" type="number" step="0.25" min="0" max={data.maxDt} inputMode="decimal" value={f.downtime_hours} onChange={e => set("downtime_hours", e.target.value)} /></Field>
            <Field label="Alasan downtime">
              <Select name="downtime_reason" required={rules.reasonReq} aria-required={rules.reasonReq} value={f.downtime_reason} onChange={e => set("downtime_reason", e.target.value)}><option value="">—</option>{data.reasons.map((l: any) => <option key={l.code} value={l.code}>{l.label}</option>)}</Select>
            </Field>
          </div>

          <div className="flex flex-col gap-2"><span className="text-sm font-medium">Foto core</span>
            <div className="grid grid-cols-2 gap-3">
              <label className="inline-flex h-[var(--control-h)] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-card text-sm font-medium shadow-xs transition-colors hover:bg-accent"><Camera className="size-4" />Ambil foto (kamera)<input id="photo-cam" type="file" accept="image/*" capture="environment" hidden onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} /></label>
              <label className="inline-flex h-[var(--control-h)] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-card text-sm font-medium shadow-xs transition-colors hover:bg-accent"><ImageIcon className="size-4" />Pilih dari galeri / file<input id="photo" type="file" accept="image/*" hidden onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} /></label>
            </div>
            <div className="text-xs text-muted-foreground" id="pname">{photoName ? `Nama file otomatis: ${photoName}.jpg` : "Nama file otomatis: isi Hole ID, Dari dan Sampai dulu (HoleID_dari_sampai)."}</div>
            {photoUrl && <motion.img initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} src={photoUrl} alt="Pratinjau foto core" className="max-h-48 w-fit rounded-lg border object-cover" />}
            {!photoUrl && rec?.photo_path && <div className="text-xs text-muted-foreground">Foto tersimpan: {rec.photo_path.split("/").pop()}</div>}
          </div>

          <Field label="Catatan"><Textarea name="remarks" rows={2} value={f.remarks} onChange={e => set("remarks", e.target.value)} /></Field>

          <div id="msgs" className="flex flex-col gap-2" aria-live="polite">
            {errors.map(m => <div key={m} className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-danger">{m}</div>)}
            {warns.map(m => <div key={m} className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-warning">{m}</div>)}
          </div>
          <div className="flex flex-wrap gap-3">
            {warns.length && !errors.length ? <Button type="button" size="lg" className="flex-1" onClick={() => save(true)} id="b-force">Tetap simpan</Button> : <Button type="submit" size="lg" className="flex-1" id="b-save">Simpan</Button>}
            {isEdit && <><Button type="button" variant="outline" size="lg" onClick={cancel}>Batal</Button><Button type="button" variant="destructive" size="lg" onClick={remove}>Hapus</Button></>}
          </div>
        </Card>
      </form>

      <Card style={{ ["--i" as string]: 1 }} id="prec">
        <CardTitle>Data Drilling Progress</CardTitle>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada data.</p> : (
          <ul className="flex flex-col divide-y">
            {rows.map(r => (
              <li key={r.id}><button type="button" onClick={() => edit(r)} className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-sm transition-colors hover:bg-accent/60">
                <span className="min-w-0"><span className="font-medium">{r.hole_id}</span> <span className="tabular-nums text-muted-foreground">{r.from_m}–{r.to_m} m</span><span className="block truncate text-xs text-muted-foreground">{r.work_date} · {r.rig_id}</span></span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{r.to_m != null && r.from_m != null ? (r.to_m - r.from_m).toFixed(2) : ""} m</span>
              </button></li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
