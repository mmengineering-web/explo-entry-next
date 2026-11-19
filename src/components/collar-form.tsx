"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Compass } from "lucide-react";
import { core, canForm, type Info } from "@/lib/boot";
import { takeEditing, FORM_OF } from "@/lib/editing";
import { decorated, makeCols } from "@/lib/rec-cols";
import { useToast } from "./toast";
import { useConfirm } from "./confirm";
import { Button } from "./ui/button";
import { Input, Select, Textarea } from "./ui/input";
import { Card, CardTitle } from "./ui/card";
import { Field, FormActions, Msgs, PhotoField, usePhoto, num, txt, s } from "./form-kit";
import { RecordList, type Col } from "./record-list";

const NUMS = ["planned_lat", "planned_lon", "planned_elev", "planned_depth_m", "asbuilt_lat", "asbuilt_lon", "asbuilt_elev", "gps_accuracy_m", "total_depth_m", "dip_deg", "azimuth_deg"] as const;
type F = { hole_id: string; hole_type: string; prospect: string; status: string; remarks: string } & Record<(typeof NUMS)[number], string>;

function deviceCode() {
  let c = localStorage.getItem("exp_device");
  if (!c) { c = Array.from(crypto.getRandomValues(new Uint8Array(2)), b => "ABCDEFGHJKLMNPQRSTUVWXYZ"[b % 24]).join(""); localStorage.setItem("exp_device", c); }
  return c;
}

export function CollarForm({ info, tick }: { info: Info; tick?: string }) {
  const toast = useToast(), ask = useConfirm();
  const [ready, setReady] = useState(false);
  const [d, setD] = useState<{ all: any[]; prospects: any[]; types: any[]; statuses: any[]; planStatus: string; gpsMax: number; cols: Col[]; rows: any[] }>({ all: [], prospects: [], types: [], statuses: [], planStatus: "", gpsMax: 10, cols: [], rows: [] });
  const [rec, setRec] = useState<any | null>(null);
  const [f, setF] = useState<F>(() => blank("", "", ""));
  const [errors, setErrors] = useState<string[]>([]);
  const [warns, setWarns] = useState<string[]>([]);
  const [gps, setGps] = useState("");
  const ph = usePhoto();
  const isEdit = !!rec;

  function blank(type: string, status: string, prospect: string): F {
    return { hole_id: "", hole_type: type, prospect, status, remarks: "", ...Object.fromEntries(NUMS.map(k => [k, ""])) } as F;
  }
  const toForm = (r: any): F => ({ hole_id: r.hole_id ?? "", hole_type: r.hole_type ?? "", prospect: r.prospect ?? "", status: r.status ?? "", remarks: r.remarks ?? "", ...Object.fromEntries(NUMS.map(k => [k, s(r[k])])) } as F);

  const load = useCallback(async () => {
    const { D, cfg, V } = await core();
    const [all, prospects] = await Promise.all([D.db.collars.toArray(), D.db.prospects.toArray()]);
    const cols = makeCols(cfg, V).collars;
    const rows = await decorated(D, "collars", all.filter((c: any) => !c.is_deleted));
    const planStatus = (cfg.codesWithFlag("collar_status", "is_plan")[0] || cfg.codes("collar_status")[0])?.code || "";
    setD({ all, prospects, types: cfg.codes("hole_type"), statuses: cfg.codes("collar_status"), planStatus, gpsMax: cfg.setting("gps_max_acc_m"), cols, rows });
    return { type: cfg.codes("hole_type")[0]?.code || "", status: planStatus };
  }, []);

  useEffect(() => {
    (async () => {
      const x = await load();
      const pend = takeEditing("collars");
      if (pend) { setRec(pend); setF(toForm(pend)); } else setF(blank(x.type, x.status, ""));
      setReady(true);
    })();
  }, [load]);
  useEffect(() => { if (ready) load(); }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof F, v: string) => setF(p => ({ ...p, [k]: v }));
  const meta = (code: string) => d.statuses.find(x => x.code === code)?.meta ?? {};
  const planned = useMemo(() => d.all.filter(c => !c.is_deleted && meta(c.status).is_plan), [d.all, d.statuses]); // eslint-disable-line react-hooks/exhaustive-deps
  const prospects = useMemo(() => [...d.prospects].sort((a, b) => String(a.prospect_name).localeCompare(String(b.prospect_name))), [d.prospects]);
  const hid = f.hole_id.trim().toUpperCase();

  const build = (): any => {
    const o: any = { ...(rec ?? { id: crypto.randomUUID(), photo_path: null, is_deleted: false }), hole_id: hid, hole_type: f.hole_type, prospect: txt(f.prospect), status: f.status, remarks: txt(f.remarks) };
    for (const k of NUMS) o[k] = num((f as any)[k]);
    return o;
  };

  async function reset() {
    setRec(null); ph.reset(); setErrors([]); setWarns([]); setGps("");
    const x = await load(); setF(blank(x.type, x.status, ""));
  }

  async function save(force = false) {
    const { D, V, S } = await core();
    const r = build();
    const v = V.validateCollar(r, { others: d.all });
    setErrors(v.errors); setWarns(v.warns);
    if (v.errors.length) return;
    if (v.warns.length && !force) return;
    const want = `collar/${r.hole_id}.jpg`;
    if (ph.blob) { r.photo_path = want; await D.db.photos.put({ id: r.id, blob: ph.blob, uploaded: false }); }
    else if (r.photo_path && r.photo_path !== want) {
      const p = await D.db.photos.get(r.id);
      if (p?.blob) { r.photo_path = want; await D.db.photos.put({ id: r.id, blob: p.blob, uploaded: false }); }
    }
    await D.saveRecord("collars", r);
    toast("Tersimpan di perangkat"); S.syncSoon();
    await reset();
  }

  async function remove() {
    if (!await ask("Hapus collar ini? (soft delete)", { title: "Hapus data?", ok: "Hapus", danger: true })) return;
    const { D, S } = await core();
    await D.saveRecord("collars", { ...build(), is_deleted: true });
    toast("Dihapus"); S.syncSoon(); await reset();
  }

  async function genId() {
    const { D } = await core();
    const prefix = `${info.site}-${f.hole_type}-${deviceCode()}`;
    const all = await D.db.collars.where("hole_id").startsWith(prefix).toArray();
    const max = all.reduce((m: number, c: any) => Math.max(m, parseInt(c.hole_id.slice(prefix.length), 10) || 0), 0);
    set("hole_id", `${prefix}${String(max + 1).padStart(3, "0")}`);
  }

  function getGps() {
    if (!navigator.geolocation) return toast("GPS tidak tersedia di perangkat ini", "err");
    setGps("Mengambil posisi…");
    navigator.geolocation.getCurrentPosition(p => {
      setF(x => ({ ...x, asbuilt_lat: p.coords.latitude.toFixed(7), asbuilt_lon: p.coords.longitude.toFixed(7), asbuilt_elev: p.coords.altitude != null ? p.coords.altitude.toFixed(1) : x.asbuilt_elev, gps_accuracy_m: p.coords.accuracy.toFixed(1) }));
      setGps(`Akurasi ±${p.coords.accuracy.toFixed(1)} m` + (p.coords.accuracy > d.gpsMax ? ` — melebihi batas ${d.gpsMax} m, ulangi di area terbuka` : ""));
    }, err => setGps("Gagal: " + err.message), { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
  }

  if (!ready) return <div className="text-sm text-muted-foreground" aria-busy>Memuat…</div>;
  const numIn = (k: (typeof NUMS)[number], extra: React.ComponentProps<"input"> = {}) => <Input name={k} type="number" step="any" inputMode="decimal" value={f[k]} onChange={e => set(k, e.target.value)} {...extra} />;
  const unknownProspect = f.prospect && !prospects.some(p => p.prospect_code === f.prospect);

  return (
    <div className="enter flex flex-col gap-5">
      <form onSubmit={e => { e.preventDefault(); save(); }} autoComplete="off" id="f" style={{ ["--i" as string]: 0 }}>
        <Card>
          <CardTitle>{isEdit ? "Edit" : "Input"} collar</CardTitle>
          <Field label="Pilih dari rencana (opsional)" hint={planned.length ? `${planned.length} lubang rencana (status "rencana"). Pilih untuk melengkapi lubang yang sudah direncanakan (koordinat as-built, status), atau biarkan untuk lubang baru.` : 'Belum ada lubang rencana di HP ini. Daftar ini terisi dari collar berstatus "rencana"; tambahkan lewat form ini atau sinkronkan setelah login.'}>
            <Select id="pick" value={rec?.id ?? ""} onChange={e => { const c = d.all.find(x => x.id === e.target.value); if (c) { setRec(c); setF(toForm(c)); ph.reset(); } else reset(); }}>
              <option value="">— lubang baru / tak terencana —</option>{planned.map(c => <option key={c.id} value={c.id}>{c.hole_id}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hole ID"><Input name="hole_id" required autoCapitalize="characters" value={f.hole_id} onChange={e => set("hole_id", e.target.value)} /></Field>
            <Field label="Tipe"><Select name="hole_type" value={f.hole_type} onChange={e => set("hole_type", e.target.value)}>{d.types.map((t: any) => <option key={t.code} value={t.code}>{t.label}</option>)}</Select></Field>
          </div>
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={genId} id="b-genid">Buat Hole ID baru (tak terencana)</Button>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prospect"><Select name="prospect" value={f.prospect} onChange={e => set("prospect", e.target.value)}><option value="">— pilih —</option>
              {prospects.map(p => <option key={p.prospect_code} value={p.prospect_code}>{p.prospect_name}</option>)}
              {unknownProspect && <option value={f.prospect}>{f.prospect} (tidak terdaftar)</option>}</Select></Field>
            <Field label="Status"><Select name="status" value={f.status} onChange={e => set("status", e.target.value)}>{d.statuses.map((t: any) => <option key={t.code} value={t.code}>{t.label}</option>)}</Select></Field>
          </div>
          <fieldset className="flex flex-col gap-3 rounded-lg border p-3"><legend className="px-1 text-sm font-semibold text-brand">Planned</legend>
            <div className="grid grid-cols-2 gap-3"><Field label="Lat">{numIn("planned_lat")}</Field><Field label="Lon">{numIn("planned_lon")}</Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Elevasi (m)">{numIn("planned_elev")}</Field><Field label="Planned depth (m)">{numIn("planned_depth_m")}</Field></div>
          </fieldset>
          <fieldset className="flex flex-col gap-3 rounded-lg border p-3"><legend className="px-1 text-sm font-semibold text-brand">As-built (GPS)</legend>
            <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" onClick={getGps} id="b-gps"><Compass />Ambil GPS</Button><span id="gpsmsg" className="text-xs text-muted-foreground">{gps}</span></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Lat">{numIn("asbuilt_lat")}</Field><Field label="Lon">{numIn("asbuilt_lon")}</Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Elevasi (m)">{numIn("asbuilt_elev")}</Field><Field label="Akurasi GPS (m)">{numIn("gps_accuracy_m")}</Field></div>
            <Field label="Total depth (m)">{numIn("total_depth_m")}</Field>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dip (°)">{numIn("dip_deg", { min: -90, max: 90, placeholder: "-90" })}</Field>
            <Field label="Azimuth (°)">{numIn("azimuth_deg", { min: 0, max: 360, placeholder: "0" })}</Field>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">Kosong = lubang vertikal (dip -90, azimuth 0).</p>
          <PhotoField label="Foto collar" ph={ph} rec={rec} name={hid ? `Nama file otomatis: ${hid}.jpg` : "Nama file otomatis: sama dengan Hole ID (isi Hole ID dulu)."} />
          <Field label="Catatan"><Textarea name="remarks" rows={2} value={f.remarks} onChange={e => set("remarks", e.target.value)} /></Field>
          <Msgs errors={errors} warns={warns} />
          <FormActions isEdit={isEdit} onCancel={reset} onDelete={remove} warnMode={!!warns.length && !errors.length} onForce={() => save(true)} />
        </Card>
      </form>
      <RecordList id="f:collars" title="Data Collar" rows={d.rows} cols={d.cols} sort={{ k: "hole_id", dir: 1 }}
        onOpen={r => { const c = d.all.find(x => x.id === r.id); if (c) { setRec(c); setF(toForm(c)); ph.reset(); window.scrollTo({ top: 0, behavior: "smooth" }); } }}
        canOpen={() => canForm(info, FORM_OF.collars)} />
    </div>
  );
}
