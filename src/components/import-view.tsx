"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { core, canForm, type Info } from "@/lib/boot";
import { useToast } from "./toast";
import { useConfirm } from "./confirm";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardTitle } from "./ui/card";
import { today } from "./form-kit";

const SHEET_LABEL: Record<string, string> = { COLLAR: "Collar", PROGRESS: "Progress", DIST_HOUR: "Jam rig", SURVEY: "Survey", SAMPLE: "Sample", ASSAY: "Assay" };
const SHEET_FORM: Record<string, string> = { COLLAR: "collar", SURVEY: "collar", PROGRESS: "progress", DIST_HOUR: "hours", SAMPLE: "sample", ASSAY: "sample" };
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ui = { parsed: null as any, file: "", withWarn: false };

let lib: Promise<any> | null = null;
function loadXlsxLib() {
  if (!lib) lib = new Promise((res, rej) => {
    const w = window as any;
    if (w.XLSX) return res(w.XLSX);
    const sc = document.createElement("script"); sc.src = "/vendor/xlsx.mini.min.js";
    sc.onload = () => res(w.XLSX);
    sc.onerror = () => { lib = null; rej(new Error("Pustaka Excel gagal dimuat (cek koneksi sekali, lalu tersimpan offline).")); };
    document.head.appendChild(sc);
  });
  return lib;
}
function save(data: BlobPart, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: XLSX_MIME })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
const cleanCode = (v: string, rig: boolean) => String(v).trim().toUpperCase().replace(/\s+/g, rig ? "-" : "_").replace(/[^A-Z0-9_-]/g, "").slice(0, 30);
const Note = ({ kind, children }: { kind: "err" | "warn" | "ok"; children: React.ReactNode }) => (
  <div className={`rounded-md border px-3 py-2 text-sm ${kind === "err" ? "border-[var(--danger-border)] bg-[var(--danger-bg)] text-danger" : kind === "ok" ? "border-[var(--success-border)] bg-[var(--success-bg)] text-success" : "border-[var(--warning-border)] bg-[var(--warning-bg)] text-warning"}`}>{children}</div>
);
const Th = ({ children }: { children?: React.ReactNode }) => <th className="whitespace-nowrap border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{children}</th>;
const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => <td className={`border-b px-3 py-2 ${className || ""}`}>{children}</td>;

export function ImportView({ info, tick }: { info: Info; tick?: string }) {
  const toast = useToast(); const ask = useConfirm();
  const [, force] = useState(0); const rerender = () => force(n => n + 1);
  const [pend, setPend] = useState(0); const [last, setLast] = useState<string | null>(null);
  const [err, setErr] = useState(""); const [done, setDone] = useState("");
  const [ana, setAna] = useState<any>(null);

  useEffect(() => { core().then(async ({ D }) => { setPend(await D.db.outbox.count()); setLast(localStorage.getItem(`exp_last_sync_${info.site}`)); }); }, [info.site, tick]);

  const analyse = useCallback(async () => {
    if (!ui.parsed) { setAna(null); return; }
    const { D, cfg } = await core();
    const IMP: any = await import("@/lib/core/importer.js");
    const [rigs, prospects, collars, progress, disthours, surveys, samples, assays] = await Promise.all(["rigs", "prospects", "collars", "progress", "disthours", "surveys", "samples", "assays"].map(t => D.db[t].toArray()));
    const layers = D.db.maplayers ? await D.db.maplayers.toArray() : [];
    const ctx = { file: ui.file, rigs, prospects, collars, progress, disthours, surveys, samples, assays, layers };
    const res = IMP.analyze(ui.parsed, ctx, { allow: ui.withWarn });
    for (const r of res) if (!canForm(info, SHEET_FORM[r.sheet])) for (const x of r.rows) { x.rec = null; x.warns = []; x.errors = ["Tidak punya izin input untuk form ini (diatur admin di Pengaturan > User)."]; x.kind = "invalid"; }
    const all = IMP.findUnregistered(ui.parsed, ctx);
    setAna({ IMP, res, ctx, unreg: all.filter((u: any) => u.kind !== "hole"), unregH: all.filter((u: any) => u.kind === "hole"), sum: IMP.summarize(res), acc: IMP.accepted(res, ui.withWarn), cfg });
  }, [info]);
  useEffect(() => { analyse(); }, [analyse]);

  async function template() {
    try {
      const { D, cfg } = await core();
      const { buildTemplate }: any = await import("@/lib/core/template.js");
      const live = (a: any[]) => (a || []).filter(x => !x.is_deleted && x.is_active !== false);
      const L = (k: string) => cfg.codes(k).map((r: any) => r.code);
      const [rigs, prospects, collars] = await Promise.all([D.db.rigs.toArray(), D.db.prospects.toArray(), D.db.collars.toArray()]);
      const u8 = buildTemplate({
        site: info.site, generated: today(), holePattern: cfg.setting("hole_id_regex"), shiftHours: cfg.setting("shift_hours"), depthFactor: cfg.setting("depth_overrun_warn_factor"),
        utmZone: cfg.setting("utm_zone"), utmHemi: cfg.setting("utm_hemisphere"),
        lists: Object.fromEntries(["hole_type", "collar_status", "sample_type", "sample_status", "layer", "shift", "downtime_reason", "activity"].map(k => [k, L(k)])),
        rigs: live(rigs).map((r: any) => r.rig_id), prospects: live(prospects).map((p: any) => p.prospect_code),
        holes: collars.filter((c: any) => !c.is_deleted).map((c: any) => c.hole_id).sort(),
        requiresAsbuilt: cfg.codesWithFlag("collar_status", "requires_asbuilt").map((r: any) => r.code), requiresTotalDepth: cfg.codesWithFlag("collar_status", "requires_total_depth").map((r: any) => r.code),
      });
      save(u8, `exploration_import_template_${info.site}.xlsx`);
    } catch (e: any) { console.error(e); toast("Template gagal dibuat: " + (e.message || e), "err"); }
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    try {
      const X = await loadXlsxLib(); const IMP: any = await import("@/lib/core/importer.js");
      ui.file = f.name; ui.withWarn = false; ui.parsed = IMP.parseWorkbook(X, await f.arrayBuffer());
      setErr(""); setDone(""); await analyse(); rerender();
    } catch (e: any) { ui.parsed = null; setAna(null); setErr(e.message || String(e)); }
  }

  const A = ana;
  const tot = (k: string) => (A ? A.sum.reduce((t: number, s: any) => t + s[k], 0) : 0);
  const nAcc = A ? (Object.values(A.acc) as any[][]).reduce((t, a) => t + a.length, 0) : 0;

  async function doImport() {
    const refused = tot("dup") + tot("invalid") + (ui.withWarn ? 0 : tot("warn"));
    if (refused && !await ask(`${refused} baris tidak ikut diimport (ditolak atau menunggu persetujuan). Lanjut import ${nAcc} baris?`)) return;
    try {
      const { D, S } = await core();
      for (const sheet of A.IMP.SHEET_ORDER) if (A.acc[sheet]?.length) await D.saveMany(A.IMP.TABLE_OF[sheet], A.acc[sheet]);
      ui.parsed = null; S.syncSoon(300); setAna(null);
      setDone(`Selesai: ${nAcc} baris disimpan di HP dan dikirim ke server saat online.${refused ? ` ${refused} baris tidak diimport.` : ""}`);
      toast("Import selesai");
    } catch (e: any) { toast(e.message || String(e), "err"); }
  }

  async function rejected() {
    const { buildXlsx }: any = await import("@/lib/core/xlsx-lite.js");
    const sheets = A.res.map((r: any) => {
      const bad = r.rows.filter((x: any) => x.kind === "dup" || x.kind === "invalid"); const p = ui.parsed.sheets[r.sheet];
      return bad.length ? { name: p.name, header: [...p.head, "REASON"], rows: bad.map((x: any) => { const cells = p.rows.find((q: any) => q.row === x.row).cells; return [...p.head.map((_: any, i: number) => cells[i] ?? null), x.errors.join(" | ")]; }) } : null;
    }).filter(Boolean);
    save(buildXlsx(sheets), `ditolak_${ui.file.replace(/\.[^.]+$/, "")}.xlsx`);
  }

  return (
    <div className="enter flex flex-col gap-5">
      <Card id="imp-card">
        <CardTitle>Import dari Excel</CardTitle>
        <p className="text-sm text-muted-foreground">Baris yang sudah ada (Hole ID, interval, atau nomor sampel yang sama) ditolak, tidak menimpa data. Pengecekan memakai data di HP ini; sinkron dulu agar terbaru (sinkron terakhir {last ? new Date(last).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "belum pernah"}{pend ? `, ${pend} data belum terkirim` : ""}).</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" id="tpl-dl" onClick={template}><Download />Unduh template</Button>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
            <FileSpreadsheet className="size-4" />Pilih file Excel
            <input id="imp-file" type="file" accept=".xlsx,.xls" className="sr-only" onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
        <div id="imp-msg">{err && <Note kind="err">{err}</Note>}</div>
      </Card>
      {done && <Card><Note kind="ok">{done}</Note></Card>}
      {A && !A.res.length && <Card><p className="text-sm text-muted-foreground">Tidak ada sheet COLLAR, PROGRESS, DIST_HOUR, SURVEY, SAMPLE, atau ASSAY di file ini. Pakai template.</p></Card>}
      {A && A.res.length > 0 && <Result A={A} info={info} nAcc={nAcc} tot={tot} refresh={analyse} doImport={doImport} rejected={rejected} setWarn={(v: boolean) => { ui.withWarn = v; analyse(); }} />}
    </div>
  );
}

function Result({ A, info, nAcc, tot, refresh, doImport, rejected, setWarn }: any) {
  const toast = useToast();
  const { res, sum, unreg, unregH, ctx, IMP, cfg } = A;
  const canHole = canForm(info, "collar");
  const canReg = !!info.can_admin && !info.guest && typeof navigator !== "undefined" && navigator.onLine;
  const notes: string[] = [...ui.parsed.notes, ...res.flatMap((r: any) => [...r.errors.map((e: string) => `${r.name}: ${e}`), ...(r.ignored.length ? [`${r.name}: kolom diabaikan: ${r.ignored.join(", ")}.`] : []), ...(r.extras.length ? [`${r.name}: kolom unsur tambahan: ${r.extras.join(", ")}.`] : [])])];
  const issues = res.flatMap((r: any) => r.rows.filter((x: any) => x.kind !== "ok").map((x: any) => ({ sheet: r.sheet, ...x })));
  const holeRe = cfg.holeRegex();
  const statusClassOf = (code: string) => { const m = cfg.metaOf("collar_status", code); return m.map_class === "planned" || (!m.map_class && m.is_plan) ? "planned" : m.map_class === "progress" ? "coh" : m.map_class || "coh"; };

  const [hSel, setHSel] = useState<Record<number, { on: boolean; type: string; st: string }>>(() => Object.fromEntries(unregH.map((u: any, i: number) => {
    const ht = cfg.codes("hole_type"); const guess = (ht.find((t: any) => u.value.split("-").some((sg: string) => sg === String(t.code).toUpperCase())) || ht[0] || {}).code;
    const stDef = (cfg.codes("collar_status").find((x: any) => u.sheets.includes("PROGRESS") ? statusClassOf(x.code) === "coh" && !cfg.metaOf("collar_status", x.code).hide_from_progress : statusClassOf(x.code) === "planned") || cfg.codes("collar_status")[0] || {}).code;
    return [i, { on: holeRe.test(u.value), type: guess, st: stDef }];
  })));
  const [uSel, setUSel] = useState<Record<number, { on: boolean; code: string; name: string }>>(() => Object.fromEntries(unreg.map((u: any, i: number) => [i, { on: true, code: cleanCode(u.value, u.kind === "rig"), name: u.value }])));
  const [hMsg, setHMsg] = useState(""); const [uMsg, setUMsg] = useState("");

  async function makeHoles() {
    const recs = unregH.map((u: any, i: number) => ({ u, s: hSel[i] })).filter((x: any) => x.s?.on).map(({ u, s }: any) => ({ id: crypto.randomUUID(), hole_id: u.value, hole_type: s.type, prospect: null, status: s.st,
      planned_lat: null, planned_lon: null, planned_elev: null, planned_depth_m: null, asbuilt_lat: null, asbuilt_lon: null, asbuilt_elev: null, gps_accuracy_m: null, total_depth_m: null, photo_path: null, remarks: "Dibuat dari import Excel, lengkapi data collar", dip_deg: null, azimuth_deg: null, is_deleted: false }));
    if (!recs.length) return setHMsg("Centang minimal satu.");
    try { const { D, S } = await core(); await D.saveMany("collars", recs); S.syncSoon(300); toast(`${recs.length} collar dibuat (lengkapi di tab Collar)`); setHMsg(""); refresh(); }
    catch (e: any) { setHMsg(e.message || String(e)); }
  }
  async function register() {
    const todo = unreg.map((u: any, i: number) => ({ u, ...uSel[i] })).filter((x: any) => x.on).map((x: any) => ({ ...x, code: x.code.trim(), name: x.name.trim() }));
    if (!todo.length) return setUMsg("Centang minimal satu.");
    const bad = todo.find((t: any) => !t.code || !t.name); if (bad) return setUMsg(`Kode dan nama wajib diisi (${bad.u.value}).`);
    try {
      const { S } = await core(); const c = S.getClient(); const chk = (r: any) => { if (r.error) throw new Error(r.error.message); };
      for (const { u, code, name } of todo) {
        if (u.kind === "rig") chk(await c.from("exp_rig").upsert({ rig_id: code, rig_name: name, is_active: true }, { onConflict: "rig_id", ignoreDuplicates: true }));
        else if (u.kind === "prospect") chk(await c.from("exp_prospect").upsert({ prospect_code: code, prospect_name: name, is_active: true }, { onConflict: "prospect_code" }));
        else { const so = Math.max(0, ...cfg.codes(u.list).map((x: any) => x.sort_order || 0)) + 10;
          chk(await c.from("exp_code_list").upsert({ list_code: u.list, code, label: name, sort_order: so, is_active: true, meta: {}, description: "Ditambah dari import Excel" }, { onConflict: "list_code,code" })); }
      }
      await S.syncNow(); await cfg.loadCfg();
      toast(`${todo.length} nilai didaftarkan`); setUMsg(""); refresh();
    } catch (e: any) { setUMsg(e.message || String(e)); }
  }

  return (
    <>
      <Card id="imp-sum">
        <CardTitle>{ui.file}</CardTitle>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><Th>Sheet</Th><Th>Baris</Th><Th>Siap</Th><Th>Peringatan</Th><Th>Ditolak</Th></tr></thead><tbody>
          {sum.map((s: any) => <tr key={s.sheet}><Td className="font-medium">{SHEET_LABEL[s.sheet]}</Td><Td>{s.total}</Td><Td>{s.ok}</Td><Td>{s.warn || "–"}</Td><Td>{s.dup + s.invalid || "–"}{s.dup ? <span className="text-xs text-muted-foreground"> ({s.dup} duplikat)</span> : null}</Td></tr>)}
        </tbody></table></div>
        {res.zone && <p className="text-xs text-muted-foreground">Zona UTM dipakai: {res.zone.zone}{res.zone.hemisphere} ({res.zone.source}).</p>}
        {notes.map((n, i) => <Note key={i} kind="warn">{n}</Note>)}
        {!(ctx.rigs || []).length && unreg.some((u: any) => u.kind === "rig") && <Note kind="warn">Belum ada rig di HP ini. Sinkron dulu supaya rig yang sudah terdaftar di server ikut terbaca, baru daftarkan yang benar-benar baru.</Note>}
        {tot("warn") > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" id="imp-warn" checked={ui.withWarn} onChange={e => setWarn(e.target.checked)} />Sertakan {tot("warn")} baris yang hanya berperingatan</label>}
        <div className="flex flex-wrap gap-3">
          <Button id="imp-go" disabled={!nAcc} onClick={doImport}>Import {nAcc} baris</Button>
          {tot("dup") + tot("invalid") > 0 && <Button variant="outline" id="imp-rej" onClick={rejected}>Unduh baris ditolak</Button>}
        </div>
      </Card>

      {unregH.length > 0 && <Card id="unregh">
        <CardTitle>Hole belum ada di Collar ({unregH.length})</CardTitle>
        <p className="text-sm text-muted-foreground">Hole ini dipakai di file tetapi belum ada di data collar, jadi barisnya ditolak. {canHole ? "Centang untuk membuat collar kosong (tanpa koordinat), lalu lengkapi nanti di tab Collar. Pemeriksaan diulang otomatis." : "Hanya user dengan hak input yang bisa membuatnya."}</p>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{canHole && <Th />}<Th>Hole ID</Th><Th>Baris</Th><Th>Dipakai di</Th>{canHole && <><Th>Tipe</Th><Th>Status</Th></>}</tr></thead><tbody>
          {unregH.map((u: any, i: number) => { const ok = holeRe.test(u.value), s = hSel[i]; return (
            <tr key={u.value}>{canHole && <Td><input type="checkbox" className="h-on" checked={!!s?.on} disabled={!ok} onChange={e => setHSel(p => ({ ...p, [i]: { ...p[i], on: e.target.checked } }))} /></Td>}
              <Td className="font-medium">{u.value}{!ok && <span className="text-xs text-muted-foreground"> (format ID tidak valid)</span>}</Td><Td>{u.count}</Td><Td>{u.sheets.map((x: string) => SHEET_LABEL[x]).join(", ")}</Td>
              {canHole && <><Td><select className="h-type h-9 rounded-md border bg-card px-2" value={s?.type} onChange={e => setHSel(p => ({ ...p, [i]: { ...p[i], type: e.target.value } }))}>{cfg.codes("hole_type").map((t: any) => <option key={t.code} value={t.code}>{t.label}</option>)}</select></Td>
                <Td><select className="h-st h-9 rounded-md border bg-card px-2" value={s?.st} onChange={e => setHSel(p => ({ ...p, [i]: { ...p[i], st: e.target.value } }))}>{cfg.codes("collar_status").map((t: any) => <option key={t.code} value={t.code}>{t.label}</option>)}</select></Td></>}
            </tr>); })}
        </tbody></table></div>
        {canHole && <div className="flex flex-wrap gap-3"><Button id="h-go" onClick={makeHoles}>Buat collar untuk yang dicentang</Button></div>}
        {hMsg && <Note kind="err">{hMsg}</Note>}
      </Card>}

      {unreg.length > 0 && <Card id="unreg">
        <CardTitle>Belum terdaftar ({unreg.length})</CardTitle>
        <p className="text-sm text-muted-foreground">Nilai ini ada di file tapi belum terdaftar di site, jadi barisnya ditolak. {canReg ? "Centang yang mau didaftarkan (kode dan nama boleh diubah), lalu daftarkan. Pemeriksaan diulang otomatis." : "Hanya admin yang online yang bisa mendaftarkan. Minta site admin mendaftarkannya di Pengaturan, atau perbaiki penulisannya di file."}</p>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{canReg && <Th />}<Th>Jenis</Th><Th>Di file</Th><Th>Baris</Th>{canReg && <><Th>Kode</Th><Th>Nama</Th></>}</tr></thead><tbody>
          {unreg.map((u: any, i: number) => { const s = uSel[i]; return (
            <tr key={`${u.kind}${u.list}${u.value}`}>{canReg && <Td><input type="checkbox" className="u-on" checked={!!s?.on} onChange={e => setUSel(p => ({ ...p, [i]: { ...p[i], on: e.target.checked } }))} /></Td>}
              <Td>{u.kind === "rig" ? "Rig" : u.kind === "prospect" ? "Prospect" : IMP.LIST_TITLE[u.list] || u.list}</Td><Td className="font-medium">{u.value}</Td><Td>{u.count}</Td>
              {canReg && <><Td><Input className="u-code h-9" value={s?.code ?? ""} onChange={e => setUSel(p => ({ ...p, [i]: { ...p[i], code: e.target.value } }))} /></Td><Td><Input className="u-name h-9" value={s?.name ?? ""} onChange={e => setUSel(p => ({ ...p, [i]: { ...p[i], name: e.target.value } }))} /></Td></>}
            </tr>); })}
        </tbody></table></div>
        {canReg && <div className="flex flex-wrap gap-3"><Button id="u-go" onClick={register}>Daftarkan terpilih</Button></div>}
        {uMsg && <Note kind="err">{uMsg}</Note>}
      </Card>}

      {issues.length > 0 && <Card id="imp-issues">
        <CardTitle>Perlu dicek ({issues.length})</CardTitle>
        {issues.slice(0, 150).map((x: any) => <div key={`${x.sheet}${x.row}`} className="flex flex-col gap-1"><b className="text-sm">{SHEET_LABEL[x.sheet]} baris {x.row}</b>{x.errors.map((m: string) => <Note key={m} kind="err">{m}</Note>)}{x.warns.map((m: string) => <Note key={m} kind="warn">{m}</Note>)}</div>)}
        {issues.length > 150 && <p className="text-xs text-muted-foreground">{issues.length - 150} baris lain tidak ditampilkan. Unduh baris ditolak untuk daftar lengkap.</p>}
      </Card>}
    </>
  );
}
