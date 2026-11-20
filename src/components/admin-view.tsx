"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { core, type Info } from "@/lib/boot";
import { cn } from "@/lib/utils";
import { useToast } from "./toast";
import { useConfirm } from "./confirm";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardTitle } from "./ui/card";
import { GridEditor, type GAction, type GCol } from "./grid-editor";

const SUBS: [string, string, boolean?][] = [["rigs", "Rig"], ["prospects", "Prospect"], ["lists", "Daftar kode"], ["settings", "Parameter"], ["users", "User", true], ["roles", "Role"]];
let sub = "rigs"; let listSel = "hole_type";

const need = (v: any, label: string) => { if (v == null || String(v).trim() === "") throw new Error(`${label} wajib diisi.`); };
const must = async (p: any) => { const { data, error } = await p; if (error) throw error; return data || []; };
const must1 = async (p: any) => { const { error } = await p; if (error) throw error; };
const mustDelete = async (p: any) => { const { data, error } = await p.select(); if (error) throw error; if (!data || !data.length) throw new Error("Tidak ada baris yang terhapus (izin ditolak?)."); };
const dn = (v: any) => (v == null || String(v).trim() === "" ? null : String(v).trim());
const DESC: GCol = { k: "description", label: "Deskripsi", type: "text", wide: true };
const randomPassword = (n = 16) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"[b % 54]).join("");

async function callUserFn(c: any, body: any) {
  const { data, error } = await c.functions.invoke("exp-admin-users", { body });
  if (error) {
    let msg = error.message || "Gagal memanggil server."; const st = error.context?.status;
    if (st === 404) msg = 'Edge Function "exp-admin-users" belum di-deploy di project Supabase ini (lihat docs/SUPER_ADMIN_GUIDE.md).';
    else if (error.context && typeof error.context.json === "function") { try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch { /* keep msg */ } }
    else if (/Failed to send/i.test(msg)) msg = "Tidak bisa menghubungi Edge Function exp-admin-users (belum di-deploy, atau offline).";
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

type Ctx = { c: any; canEdit: boolean; canSuper: boolean; info: Info; reload: () => void; conf: any };

export function AdminView({ info }: { info: Info }) {
  const canEdit = !!info.can_admin, canSuper = !!info.can_super;
  const subs = SUBS.filter(s => canEdit || !s[2]);
  const [cur, setCur] = useState(subs.some(s => s[0] === sub) ? sub : "rigs");
  const [rev, setRev] = useState(0);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const reload = useCallback(() => setRev(n => n + 1), []);
  useEffect(() => { const f = () => setOnline(navigator.onLine); window.addEventListener("online", f); window.addEventListener("offline", f); return () => { window.removeEventListener("online", f); window.removeEventListener("offline", f); }; }, []);
  useEffect(() => { core().then(({ S, conf }) => setCtx({ c: S.getClient(), canEdit, canSuper, info, reload, conf })); }, [canEdit, canSuper, info, reload]);
  const pick = (k: string) => { sub = k; setCur(k); };

  return (
    <div className="enter flex flex-col gap-5">
      <Card id="adm-head">
        <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Pengaturan</CardTitle>
          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", canSuper ? "border-[var(--warning-border)] bg-[var(--warning-bg)] text-warning" : canEdit ? "border-[var(--success-border)] bg-[var(--success-bg)] text-success" : "text-muted-foreground")}>{canSuper ? "super admin" : canEdit ? "bisa edit" : "view only"}</span></div>
        <p className="text-sm text-muted-foreground">Arti setiap kode, rig, prospect, dan role yang dipakai di aplikasi ini.</p>
        {!online && <div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-warning">Menu ini butuh internet untuk dibuka. Perubahan langsung tersimpan di server site.</div>}
        <SubNav items={subs.map(([k, l]) => [k, l])} cur={cur} on={pick} id="subnav" />
      </Card>
      {online && ctx && <Section key={`${cur}-${rev}-${cur === "lists" ? listSel : ""}`} name={cur} ctx={ctx} />}
    </div>
  );
}

function SubNav({ items, cur, on, id }: { items: string[][]; cur: string; on: (k: string) => void; id?: string }) {
  return <div id={id} className="flex flex-wrap gap-1.5">{items.map(([k, l]) => <button key={k} data-s={k} onClick={() => on(k)} className={cn("h-8 rounded-full border px-3 text-sm transition-colors", k === cur ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}>{l}</button>)}</div>;
}

function Section({ name, ctx }: { name: string; ctx: Ctx }) {
  const [node, setNode] = useState<React.ReactNode>(null); const [err, setErr] = useState("");
  useEffect(() => {
    let dead = false;
    (async () => {
      try { const n = await ({ rigs: Rigs, prospects: Prospects, lists: Lists, settings: Settings, users: Users, roles: Roles } as any)[name](ctx); if (!dead) setNode(n); }
      catch (e: any) { if (!dead) setErr(e.message || String(e)); }
    })();
    return () => { dead = true; };
  }, [name, ctx]);
  if (err) return <div className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-danger">{err}</div>;
  return node ? <>{node}</> : <div className="text-sm text-muted-foreground" aria-busy>Memuat…</div>;
}

const delAction = (label: string, text: (r: any) => string, run: (r: any) => Promise<any>): GAction => ({ id: "del", label, danger: true, ok: "Dihapus", confirm: text, run });

async function Rigs({ c, canEdit, canSuper, reload }: Ctx) {
  const rows = await must(c.from("exp_rig").select("*").order("rig_id"));
  return <GridEditor title="Rig" rows={rows} reload={reload} canEdit={canEdit}
    note="Rig yang bisa dipilih di form Drilling Progress. Nonaktifkan rig yang sudah tidak dipakai."
    blank={{ rig_id: "", rig_name: "", rig_type: "", description: "", is_active: true }}
    cols={[{ k: "rig_id", label: "Rig ID", type: "text", pk: true }, { k: "rig_name", label: "Nama", type: "text" }, { k: "rig_type", label: "Tipe", type: "text" }, DESC, { k: "is_active", label: "Aktif", type: "bool" }]}
    save={async (r, isNew) => { need(r.rig_id, "Rig ID"); need(r.rig_name, "Nama"); if (isNew && rows.some((x: any) => x.rig_id === r.rig_id)) throw new Error("Rig ID sudah ada.");
      await must1(c.from("exp_rig").upsert({ rig_id: r.rig_id, rig_name: r.rig_name, rig_type: dn(r.rig_type), description: dn(r.description), is_active: r.is_active }, { onConflict: "rig_id" })); }}
    actions={canSuper ? [delAction("Hapus", r => `Hapus rig "${r.rig_id}" secara permanen? Tidak bisa dibatalkan.`, r => mustDelete(c.from("exp_rig").delete().eq("rig_id", r.rig_id)))] : []} />;
}

async function Prospects({ c, canEdit, canSuper, reload }: Ctx) {
  const rows = await must(c.from("exp_prospect").select("*").order("prospect_code"));
  return <GridEditor title="Prospect" rows={rows} reload={reload} canEdit={canEdit}
    note="Area/prospek yang bisa dipilih di form Collar (yang tampil di dropdown adalah Nama)."
    blank={{ prospect_code: "", prospect_name: "", description: "", is_active: true }}
    cols={[{ k: "prospect_code", label: "Kode", type: "text", pk: true }, { k: "prospect_name", label: "Nama", type: "text" }, DESC, { k: "is_active", label: "Aktif", type: "bool" }]}
    save={async (r, isNew) => { need(r.prospect_code, "Kode"); need(r.prospect_name, "Nama"); if (isNew && rows.some((x: any) => x.prospect_code === r.prospect_code)) throw new Error("Kode sudah ada.");
      await must1(c.from("exp_prospect").upsert({ prospect_code: r.prospect_code, prospect_name: r.prospect_name, description: dn(r.description), is_active: r.is_active }, { onConflict: "prospect_code" })); }}
    actions={canSuper ? [delAction("Hapus", r => `Hapus prospect "${r.prospect_code}" secara permanen? Tidak bisa dibatalkan.`, r => mustDelete(c.from("exp_prospect").delete().eq("prospect_code", r.prospect_code)))] : []} />;
}

async function Lists({ c, canEdit, canSuper, reload, conf }: Ctx) {
  const { LIST_DEFS } = conf; const def = LIST_DEFS[listSel];
  const rows = await must(c.from("exp_code_list").select("*").eq("list_code", listSel).order("sort_order"));
  const upper = ["hole_type", "shift", "layer"].includes(listSel);
  const sel = listSel;
  return (
    <>
      <Card><SubNav id="listnav" items={Object.entries(LIST_DEFS).map(([k, d]: any) => [k, d.label])} cur={listSel} on={k => { listSel = k; reload(); }} /></Card>
      <GridEditor title={def.label} rows={rows} reload={reload} canEdit={canEdit}
        help={canEdit ? <><b>Urutan</b> pilihan di dropdown form = urutan baris di tabel ini. <b>Seret ikon titik-titik</b> di kiri baris ke atas/bawah untuk mengubahnya (atau fokus ikon lalu tekan ↑ ↓). Tersimpan otomatis.</> : <><b>Urutan</b> pilihan di dropdown form = urutan baris di tabel ini (atas = muncul pertama).</>}
        note={sel === "hole_type" ? "Kode tipe dipakai di Hole ID (mis. AG, TP). Kode tidak bisa diubah setelah dibuat; nonaktifkan bila tak dipakai lagi." : "Kode tidak bisa diubah setelah dibuat; nonaktifkan bila tak dipakai lagi. Dropdown hanya menampilkan Label."}
        blank={{ code: "", label: "", description: "", sort_order: (rows.at(-1)?.sort_order ?? 0) + 10, is_active: true, meta: {} }}
        cols={[{ k: "code", label: "Kode", type: "text", pk: true }, { k: "label", label: "Label", type: "text" }, DESC, { k: "is_active", label: "Aktif", type: "bool" },
          ...def.flags.map((f: any) => (f.choices ? { k: "meta." + f.k, label: f.label, type: "select", options: f.choices } : { k: "meta." + f.k, label: f.label, type: "bool" }))]}
        save={async (r, isNew) => {
          need(r.code, "Kode"); need(r.label, "Label"); const code = upper ? r.code.toUpperCase() : r.code;
          if (!/^[A-Za-z0-9_-]{1,30}$/.test(code)) throw new Error("Kode: huruf/angka/_/- saja (maks 30).");
          if (isNew && rows.some((x: any) => x.code === code)) throw new Error("Kode sudah ada.");
          await must1(c.from("exp_code_list").upsert({ list_code: sel, code, label: r.label, description: dn(r.description), sort_order: r.sort_order ?? 100, is_active: r.is_active, meta: r.meta || {} }, { onConflict: "list_code,code" }));
        }}
        reorder={async ordered => { const ups: [string, number][] = []; ordered.forEach((r, i) => { const n = (i + 1) * 10; if (r.sort_order !== n) { ups.push([r.code, n]); r.sort_order = n; } });
          await Promise.all(ups.map(([code, n]) => must1(c.from("exp_code_list").update({ sort_order: n }).eq("list_code", sel).eq("code", code)))); }}
        actions={canSuper ? [delAction("Hapus", r => `Hapus kode "${r.code}" (${r.label}) secara permanen? Tidak bisa dibatalkan.`, r => mustDelete(c.from("exp_code_list").delete().eq("list_code", sel).eq("code", r.code)))] : []} />
    </>
  );
}

async function Settings({ c, canEdit, reload, conf }: Ctx) {
  const { SETTING_DEFS, DEFAULTS } = conf;
  const rows = await must(c.from("exp_setting").select("key,value"));
  const cur: any = { ...DEFAULTS }; rows.forEach((r: any) => { cur[r.key] = r.value; });
  return <SettingsForm c={c} canEdit={canEdit} reload={reload} defs={SETTING_DEFS} cur={cur} />;
}
function SettingsForm({ c, canEdit, reload, defs, cur }: any) {
  const toast = useToast(); const ask = useConfirm();
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(defs.map((d: any) => [d.key, String(cur[d.key] ?? "")])));
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); const out: any[] = []; setBusy(true);
    try {
      for (const dd of defs) {
        const raw = (v[dd.key] ?? "").trim();
        if (dd.type === "choice") { if (!dd.choices.some((o: any) => o.v === raw)) throw new Error(`${dd.label}: pilihan tidak valid.`); out.push({ key: dd.key, value: raw }); }
        else if (dd.type === "number") {
          if (dd.optional && raw === "") continue;
          const n = Number(raw);
          if (raw === "" || isNaN(n) || n < dd.min || n > dd.max || (dd.step === 1 && !Number.isInteger(n))) throw new Error(`${dd.label}: harus angka ${dd.min}–${dd.max}.`);
          out.push({ key: dd.key, value: n });
        } else {
          try { new RegExp(raw); } catch { throw new Error(`${dd.label}: regex tidak valid.`); }
          if (!new RegExp(raw).test("WKM-AG-0001") && !await ask('Pola ini tidak cocok dengan contoh "WKM-AG-0001". Tetap simpan?', { title: "Pola tidak cocok", ok: "Tetap simpan" })) { setBusy(false); return; }
          out.push({ key: dd.key, value: raw });
        }
      }
      const now = new Date().toISOString();
      await must1(c.from("exp_setting").upsert(out.map(o => ({ ...o, updated_at: now })), { onConflict: "key" }));
      toast("Parameter tersimpan"); (await core()).S.syncSoon(300); reload();
    } catch (err: any) { toast(err.message || String(err), "err"); setBusy(false); }
  }
  return (
    <Card><form id="sf" onSubmit={submit} className="flex flex-col gap-4">
      <CardTitle>Parameter site</CardTitle>
      <div className="grid gap-4 md:grid-cols-2">
        {defs.map((dd: any) => (
          <label key={dd.key} className="flex flex-col gap-1.5 text-sm font-medium">{dd.label}
            {dd.type === "choice"
              ? <select name={dd.key} disabled={!canEdit} value={v[dd.key]} onChange={e => setV(p => ({ ...p, [dd.key]: e.target.value }))} className="h-[var(--control-h)] rounded-md border border-input bg-card px-3 text-sm">{dd.choices.map((o: any) => <option key={o.v} value={o.v}>{o.t}</option>)}</select>
              : <Input name={dd.key} disabled={!canEdit} type={dd.type === "number" ? "number" : "text"} step={dd.type === "number" ? dd.step || "any" : undefined} min={dd.min} max={dd.max} value={v[dd.key]} onChange={e => setV(p => ({ ...p, [dd.key]: e.target.value }))} />}
            <span className="text-xs font-normal text-muted-foreground">{dd.hint}</span>
          </label>))}
      </div>
      {canEdit && <div><Button type="submit" disabled={busy}>Simpan semua</Button></div>}
    </form></Card>
  );
}

async function Users({ c, canEdit, canSuper, info, reload }: Ctx) {
  const roles = await must(c.from("exp_role_def").select("*").eq("is_active", true).order("role"));
  let formsReady = true, rows: any[];
  { const r = await c.from("exp_profile").select("user_id,full_name,role,is_active,email,input_forms").order("full_name");
    if (r.error) { formsReady = false; rows = await must(c.from("exp_profile").select("user_id,full_name,role,is_active,email").order("full_name")); } else rows = r.data; }
  const writerRole = new Set(roles.filter((r: any) => r.can_write).map((r: any) => r.role));
  const FORMS: [string, string][] = [["progress", "Progress"], ["collar", "Collar"], ["hours", "Dist. Hour"], ["sample", "Sampel"]];
  for (const r of rows) r._f = Object.fromEntries(FORMS.map(([k]) => [k, !Array.isArray(r.input_forms) || r.input_forms.includes(k)]));
  const superRole = new Set(roles.filter((r: any) => r.can_super).map((r: any) => r.role));
  const allOpts = roles.map((r: any) => ({ v: r.role, t: r.label }));
  const opts = roles.filter((r: any) => canSuper || !r.can_super).map((r: any) => ({ v: r.role, t: r.label }));
  const me = String(info.email || "").toLowerCase();
  return (
    <>
      {canSuper && <NewUser c={c} opts={opts} reload={reload} />}
      <GridEditor title="User" rows={rows} reload={reload} canEdit={canEdit}
        note={(formsReady ? 'Kolom "Input …" membatasi form yang boleh diisi user (hanya untuk role dengan izin input; semua tercentang = semua form). ' : "Pembatasan per form butuh migrasi 0012 di site ini (belum dijalankan). ") + (canSuper ? "Super admin: tambah user di atas, hapus atau reset password per baris. Menonaktifkan (hilangkan centang Aktif) menahan akses tanpa menghapus akun." : "Akun login baru dibuat oleh super admin. Di sini Anda mengatur role dan menonaktifkan user yang sudah ada. Akun super admin hanya bisa diubah oleh super admin.")}
        blank={{ email: "", full_name: "", role: opts[0]?.v || "", is_active: true, _f: { progress: true, collar: true, hours: true, sample: true } }}
        cols={[{ k: "email", label: "Email", type: "text", pk: true }, { k: "full_name", label: "Nama", type: "text" }, { k: "role", label: "Role", type: "select", options: opts, allOptions: allOpts },
          ...(formsReady ? FORMS.map(([k, l]) => ({ k: "f." + k, label: "Input " + l, type: "bool", dep: { k: "role", test: (v: string) => writerRole.has(v) }, hint: "Hanya untuk role yang boleh input data. Hilangkan centang untuk melarang user ini mengisi form tersebut." } as GCol)) : []),
          { k: "is_active", label: "Aktif", type: "bool" }]}
        locked={r => !canSuper && superRole.has(r.role)}
        save={async r => { need(r.email, "Email"); need(r.full_name, "Nama"); need(r.role, "Role");
          const args: any = { p_email: r.email, p_name: r.full_name, p_role: r.role, p_active: r.is_active };
          if (formsReady) { const on = FORMS.map(([k]) => k).filter(k => r._f?.[k]); args.p_forms = !writerRole.has(r.role) || on.length === FORMS.length ? null : on; }
          await must1(c.rpc("exp_admin_upsert_profile", args)); }}
        actions={canSuper ? [
          { id: "pw", label: "Reset password", ok: "Password diganti", run: async r => { const pw = prompt(`Password baru untuk ${r.email} (min. 10 karakter):`, randomPassword()); if (pw == null) return false; await callUserFn(c, { action: "reset_password", user_id: r.user_id, password: pw }); alert(`Password baru untuk ${r.email}:\n\n${pw}\n\nSampaikan secara pribadi.`); } },
          { id: "del", label: "Hapus", danger: true, ok: "User dihapus", show: r => String(r.email || "").toLowerCase() !== me, confirm: r => `Hapus akun "${r.full_name}" (${r.email}) secara permanen? Akun login ikut terhapus dan tidak bisa dibatalkan.`, run: r => callUserFn(c, { action: "delete", user_id: r.user_id }) },
        ] : []} />
    </>
  );
}

function NewUser({ c, opts, reload }: { c: any; opts: { v: string; t: string }[]; reload: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ email: "", full_name: "", role: opts[0]?.v || "", password: "" }); const [busy, setBusy] = useState(false);
  const up = (k: string) => (e: React.ChangeEvent<any>) => setF(p => ({ ...p, [k]: e.target.value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await callUserFn(c, { action: "create", ...f }); toast(`Akun ${f.email.trim()} dibuat`); reload(); }
    catch (err: any) { toast(err.message || String(err), "err"); setBusy(false); }
  }
  return (
    <Card><form id="nf" onSubmit={submit} className="flex flex-col gap-4">
      <CardTitle>Tambah user baru</CardTitle>
      <p className="text-sm text-muted-foreground">Membuat akun login langsung dari sini (lewat Edge Function). Kirim email dan password ke orangnya secara pribadi.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">Email<Input name="email" type="email" required autoComplete="off" value={f.email} onChange={up("email")} /></label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">Nama lengkap<Input name="full_name" required autoComplete="off" value={f.full_name} onChange={up("full_name")} /></label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">Role<select name="role" value={f.role} onChange={up("role")} className="h-[var(--control-h)] rounded-md border border-input bg-card px-3 text-sm">{opts.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}</select></label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">Password (min. 10 karakter)<Input name="password" type="text" minLength={10} required autoComplete="off" value={f.password} onChange={up("password")} /></label>
      </div>
      <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" id="genpw" onClick={() => setF(p => ({ ...p, password: randomPassword() }))}>Buat password acak</Button><Button type="submit" disabled={busy}>Buat akun</Button></div>
    </form></Card>
  );
}

async function Roles({ c, canEdit, canSuper, reload }: Ctx) {
  const rows = await must(c.from("exp_role_def").select("*").order("role"));
  return <GridEditor title="Role" rows={rows} reload={reload} canEdit={canEdit}
    note={'Izin: "Boleh input" = simpan data (form mana saja yang boleh diisi tiap user diatur di sub-tab User). "Admin" = kelola menu ini. ' + (canSuper ? '"Super" = hapus permanen data master, tambah/hapus user. ' : "") + "Semua role aktif bisa melihat data. Sistem menolak bila admin atau super admin aktif terakhir akan hilang."}
    blank={{ role: "", label: "", description: "", can_write: true, can_admin: false, can_super: false, is_active: true }}
    cols={[{ k: "role", label: "Kode role (huruf kecil)", type: "text", pk: true }, { k: "label", label: "Label", type: "text" }, DESC,
      { k: "can_write", label: "Boleh input data", type: "bool" }, { k: "can_admin", label: "Admin", type: "bool" },
      ...(canSuper ? [{ k: "can_super", label: "Super", type: "bool" } as GCol] : []), { k: "is_active", label: "Aktif", type: "bool" }]}
    locked={r => !canSuper && !!r.can_super}
    save={async (r, isNew) => { need(r.role, "Kode role"); need(r.label, "Label");
      if (!/^[a-z][a-z0-9_]{1,30}$/.test(r.role)) throw new Error("Kode role: huruf kecil/angka/_ (2–31 karakter, diawali huruf).");
      if (isNew && rows.some((x: any) => x.role === r.role)) throw new Error("Kode role sudah ada.");
      const payload: any = { role: r.role, label: r.label, description: dn(r.description), can_write: r.can_write, can_admin: r.can_admin || !!r.can_super, is_active: r.is_active };
      if (canSuper) payload.can_super = !!r.can_super;
      await must1(c.from("exp_role_def").upsert(payload, { onConflict: "role" })); }}
    actions={canSuper ? [delAction("Hapus", r => `Hapus role "${r.role}" secara permanen? (Ditolak bila masih dipakai user.)`, r => mustDelete(c.from("exp_role_def").delete().eq("role", r.role)))] : []} />;
}
