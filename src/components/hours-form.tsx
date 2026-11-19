"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { core, canForm, type Info } from "@/lib/boot";
import { takeEditing, FORM_OF } from "@/lib/editing";
import { decorated, makeCols } from "@/lib/rec-cols";
import { useToast } from "./toast";
import { useConfirm } from "./confirm";
import { Input, Select, Textarea } from "./ui/input";
import { Card, CardTitle } from "./ui/card";
import { Field, FormActions, Msgs, today, num, txt, s, t5 } from "./form-kit";
import { RecordList, type Col } from "./record-list";

type F = { work_date: string; rig_id: string; from_time: string; to_time: string; dur: string; activity: string; fuel_l: string; polymer_l: string; oil_hyd_l: string; remarks: string };
const mm = (t: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const fmtH = (h: number) => String(Math.round(h * 100) / 100);
const durOf = (a: string, b: string) => { const x = mm(a), y = mm(b); return x != null && y != null && y > x ? String(y - x) : ""; };
// remember the last date/rig across saves (module scope = survives tab switches)
const last = { date: "", rig: "" };

export function HoursForm({ info, tick }: { info: Info; tick?: string }) {
  const toast = useToast(), ask = useConfirm();
  const [ready, setReady] = useState(false);
  const [d, setD] = useState<{ rigs: any[]; all: any[]; acts: any[]; cols: Col[]; rows: any[]; hoursOf: (r: any) => number }>({ rigs: [], all: [], acts: [], cols: [], rows: [], hoursOf: () => 0 });
  const [rec, setRec] = useState<any | null>(null);
  const [f, setF] = useState<F>({ work_date: today(), rig_id: "", from_time: "", to_time: "", dur: "", activity: "", fuel_l: "", polymer_l: "", oil_hyd_l: "", remarks: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const isEdit = !!rec;

  const load = useCallback(async () => {
    const { D, cfg, V } = await core();
    const [rigs, all] = await Promise.all([D.db.rigs.toArray(), D.db.disthours.filter((x: any) => !x.is_deleted).toArray()]);
    const cols = makeCols(cfg, V).disthours;
    const rows = await decorated(D, "disthours", all);
    setD({ rigs, all, acts: cfg.codes("activity"), cols, rows, hoursOf: V.hoursOf });
    return { all, act: cfg.codes("activity")[0]?.code || "" };
  }, []);

  const prevEnd = (all: any[], date: string, rig: string, skip?: string) =>
    all.filter(x => x.work_date === date && x.rig_id === rig && x.id !== skip).map(x => t5(x.to_time)).sort().pop() || "";

  const fresh = (all: any[], act: string, date = last.date || today(), rig = last.rig || localStorage.getItem("exp_last_rig") || ""): F => {
    const from = prevEnd(all, date, rig);
    return { work_date: date, rig_id: rig, from_time: from, to_time: "", dur: "", activity: act, fuel_l: "", polymer_l: "", oil_hyd_l: "", remarks: "" };
  };
  const toForm = (r: any): F => ({ work_date: r.work_date, rig_id: r.rig_id ?? "", from_time: t5(r.from_time), to_time: t5(r.to_time), dur: durOf(t5(r.from_time), t5(r.to_time)), activity: r.activity ?? "",
    fuel_l: s(r.fuel_l), polymer_l: s(r.polymer_l), oil_hyd_l: s(r.oil_hyd_l), remarks: r.remarks ?? "" });

  useEffect(() => {
    (async () => {
      const x = await load();
      const pend = takeEditing("disthours");
      if (pend) { setRec(pend); setF(toForm(pend)); } else setF(fresh(x.all, x.act));
      setReady(true);
    })();
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready) load(); }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof F>(k: K, v: F[K]) => setF(p => ({ ...p, [k]: v }));
  // a new entry starts where the previous one of this rig/day ended
  const setDateRig = (k: "work_date" | "rig_id", v: string) => setF(p => {
    const n = { ...p, [k]: v };
    if (!isEdit) { n.from_time = prevEnd(d.all, n.work_date, n.rig_id); n.dur = durOf(n.from_time, n.to_time); }
    return n;
  });
  const setTime = (k: "from_time" | "to_time", v: string) => setF(p => { const n = { ...p, [k]: v }; n.dur = durOf(n.from_time, n.to_time); return n; });
  const setDur = (v: string) => setF(p => {
    const n = { ...p, dur: v }, m = Number(v);
    if (!m || m <= 0) return n;
    if (!n.from_time) n.from_time = prevEnd(d.all, n.work_date, n.rig_id, rec?.id) || "07:00";
    n.to_time = hhmm(Math.min((mm(n.from_time) ?? 0) + Math.round(m), 1439));
    return n;
  });

  const build = (): any => ({
    ...(rec ?? { id: crypto.randomUUID(), is_deleted: false }), work_date: f.work_date, rig_id: f.rig_id.trim(), from_time: f.from_time, to_time: f.to_time, activity: f.activity,
    fuel_l: num(f.fuel_l), polymer_l: num(f.polymer_l), oil_hyd_l: num(f.oil_hyd_l), remarks: txt(f.remarks),
  });
  const cur = build();
  const hrs = d.hoursOf(cur);

  async function reset(keep?: { date: string; rig: string }) {
    setRec(null); setErrors([]);
    const x = await load(); setF(fresh(x.all, x.act, keep?.date, keep?.rig));
  }
  async function save() {
    const { D, V, S } = await core();
    const r = build();
    const v = V.validateDist(r, { siblings: d.all });
    setErrors(v.errors);
    if (v.errors.length) return;
    await D.saveRecord("disthours", r);
    if (r.rig_id) localStorage.setItem("exp_last_rig", r.rig_id);
    last.date = r.work_date; last.rig = r.rig_id;
    toast("Tersimpan di perangkat"); S.syncSoon();
    await reset({ date: r.work_date, rig: r.rig_id });
  }
  async function remove() {
    if (!await ask("Hapus entri ini?", { title: "Hapus data?", ok: "Hapus", danger: true })) return;
    const { D, S } = await core();
    await D.saveRecord("disthours", { ...build(), is_deleted: true });
    toast("Dihapus"); S.syncSoon(); await reset();
  }

  // accumulation: hours per rig and activity for the chosen date
  const acc = useMemo(() => {
    const day = d.all.filter(x => x.work_date === f.work_date);
    const known = new Set(d.acts.map((a: any) => a.code));
    const cols = [...d.acts, ...[...new Set(day.map(x => x.activity))].filter(a => !known.has(a)).map(a => ({ code: a, label: a }))];
    const rigIds = [...new Set(day.map(x => x.rig_id))].sort();
    const sum = (rg: string, ac: string) => day.filter(x => x.rig_id === rg && x.activity === ac).reduce((t, x) => t + d.hoursOf(x), 0);
    return { cols, rigIds, sum };
  }, [d, f.work_date]);

  if (!ready) return <div className="text-sm text-muted-foreground" aria-busy>Memuat…</div>;
  const rigOpts = [...d.rigs]; if (f.rig_id && !d.rigs.some((r: any) => r.rig_id === f.rig_id)) rigOpts.push({ rig_id: f.rig_id, rig_name: f.rig_id });
  const numIn = (k: "fuel_l" | "polymer_l" | "oil_hyd_l") => <Input name={k} type="number" step="0.1" min="0" inputMode="decimal" value={f[k]} onChange={e => set(k, e.target.value)} />;

  return (
    <div className="enter flex flex-col gap-5">
      <form onSubmit={e => { e.preventDefault(); save(); }} autoComplete="off" id="f" style={{ ["--i" as string]: 0 }}>
        <Card>
          <CardTitle>{isEdit ? "Edit" : "Input"} distribution hour</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Waktu (tanggal)"><Input name="work_date" type="date" required value={f.work_date} onChange={e => setDateRig("work_date", e.target.value)} /></Field>
            <Field label="Rig">
              {d.rigs.length || f.rig_id
                ? <Select name="rig_id" required value={f.rig_id} onChange={e => setDateRig("rig_id", e.target.value)}><option value="">— pilih —</option>{rigOpts.map((r: any) => <option key={r.rig_id} value={r.rig_id}>{r.rig_name || r.rig_id}</option>)}</Select>
                : <Input name="rig_id" required autoCapitalize="characters" placeholder="mis. RIG-01" value={f.rig_id} onChange={e => setDateRig("rig_id", e.target.value)} />}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="From"><Input name="from_time" type="time" required value={f.from_time} onChange={e => setTime("from_time", e.target.value)} /></Field>
            <Field label="To"><Input name="to_time" type="time" required value={f.to_time} onChange={e => setTime("to_time", e.target.value)} /></Field>
            <Field label="Durasi (menit)"><Input name="dur" type="number" min="1" max="1440" step="1" inputMode="numeric" placeholder="atau isi ini" value={f.dur} onChange={e => setDur(e.target.value)} /></Field>
            <Field label="Jam"><Input name="hrs" readOnly value={hrs ? fmtH(hrs) : ""} /></Field>
          </div>
          <Field label="Activity"><Select name="activity" value={f.activity} onChange={e => set("activity", e.target.value)}>
            {d.acts.map((a: any) => <option key={a.code} value={a.code}>{a.label}</option>)}
            {f.activity && !d.acts.some((a: any) => a.code === f.activity) && <option value={f.activity}>{f.activity}</option>}</Select></Field>
          <fieldset className="flex flex-col gap-3 rounded-lg border p-3"><legend className="px-1 text-sm font-semibold text-brand">Consumables (opsional)</legend>
            <div className="grid grid-cols-3 gap-3"><Field label="Fuel (L)">{numIn("fuel_l")}</Field><Field label="Polymer (L)">{numIn("polymer_l")}</Field><Field label="Hyd oil (L)">{numIn("oil_hyd_l")}</Field></div>
          </fieldset>
          <Field label="Remarks"><Textarea name="remarks" rows={2} value={f.remarks} onChange={e => set("remarks", e.target.value)} /></Field>
          <Msgs errors={errors} warns={[]} />
          <FormActions isEdit={isEdit} onCancel={() => reset()} onDelete={remove} />
        </Card>
      </form>

      <Card id="hlists" style={{ ["--i" as string]: 1 }}>
        <CardTitle>Akumulasi jam per aktivitas · {f.work_date}</CardTitle>
        {acc.rigIds.length ? (
          <div className="overflow-auto rounded-lg border"><table className="w-full border-collapse text-sm">
            <thead className="bg-muted text-left text-xs text-muted-foreground"><tr><th className="px-2.5 py-2">Rig</th>{acc.cols.map((a: any) => <th key={a.code} className="whitespace-nowrap px-2.5 py-2 text-right">{a.label}</th>)}<th className="px-2.5 py-2 text-right">Total</th></tr></thead>
            <tbody>{acc.rigIds.map(rg => (
              <tr key={rg} className="border-t"><td className="px-2.5 py-2 font-medium">{rg}</td>
                {acc.cols.map((a: any) => { const v = acc.sum(rg, a.code); return <td key={a.code} className="px-2.5 py-2 text-right tabular-nums">{v ? fmtH(v) : "–"}</td>; })}
                <td className="px-2.5 py-2 text-right font-semibold tabular-nums">{fmtH(acc.cols.reduce((t: number, a: any) => t + acc.sum(rg, a.code), 0))}</td></tr>
            ))}</tbody></table></div>
        ) : <p className="text-sm text-muted-foreground">Belum ada jam rig di tanggal ini.</p>}
      </Card>

      <RecordList id="f:disthours" title="Data Distribution Hour" rows={d.rows} cols={d.cols} sort={{ k: "work_date", dir: -1 }}
        onOpen={r => { const x = d.all.find(y => y.id === r.id); if (x) { setRec(x); setF(toForm(x)); setErrors([]); window.scrollTo({ top: 0, behavior: "smooth" }); } }}
        canOpen={() => canForm(info, FORM_OF.disthours)} />
    </div>
  );
}
