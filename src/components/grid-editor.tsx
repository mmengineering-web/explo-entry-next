"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { core } from "@/lib/boot";
import { cn } from "@/lib/utils";
import { useToast } from "./toast";
import { useConfirm } from "./confirm";
import { Button } from "./ui/button";
import { Card, CardTitle } from "./ui/card";

export type GCol = { k: string; label: string; type: "text" | "number" | "bool" | "select"; pk?: boolean; wide?: boolean; hint?: string; options?: { v: string; t: string }[]; allOptions?: { v: string; t: string }[]; dep?: { k: string; test: (v: any) => boolean } };
export type GAction = { id: string; label: string; danger?: boolean; ok?: string; show?: (r: any) => boolean; confirm?: (r: any) => string; run: (r: any) => Promise<any> };

export const getv = (row: any, k: string) => k.startsWith("meta.") ? (row.meta || {})[k.slice(5)] : k.startsWith("f.") ? (row._f || {})[k.slice(2)] : row[k];
const setv = (row: any, k: string, v: any) => k.startsWith("meta.") ? { ...row, meta: { ...(row.meta || {}), [k.slice(5)]: v } } : k.startsWith("f.") ? { ...row, _f: { ...(row._f || {}), [k.slice(2)]: v } } : { ...row, [k]: v };
const norm = (c: GCol, row: any) => { const v = getv(row, c.k); return c.type === "bool" ? (v ? "1" : "0") : String(v ?? ""); };
const dirty = (cols: GCol[], a: any, b: any) => cols.some(c => norm(c, a) !== norm(c, b));
const clean = (cols: GCol[], row: any) => { let out = row; for (const c of cols) { const v = getv(out, c.k); if (c.type === "text" && typeof v === "string") out = setv(out, c.k, v.trim()); } return out; };
const off = (c: GCol, row: any) => !!c.dep && !c.dep.test(getv(row, c.dep.k));

export function GridEditor({ title, note, help, rows, cols, blank, save, reload, canEdit, locked = () => false, actions = [], reorder }: {
  title: string; note?: string; help?: React.ReactNode; rows: any[]; cols: GCol[]; blank: any;
  save: (row: any, isNew: boolean) => Promise<void>; reload: () => void; canEdit: boolean; locked?: (r: any) => boolean;
  actions?: GAction[]; reorder?: (ordered: any[]) => Promise<void>;
}) {
  const toast = useToast(); const ask = useConfirm();
  const [base, setBase] = useState<any[]>(rows);
  const [draft, setDraft] = useState<any[]>(rows);
  const [nw, setNw] = useState<any>(blank);
  const [errs, setErrs] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const body = useRef<HTMLTableSectionElement>(null);
  const dragOn = !!(canEdit && reorder);
  const dirtyIdx = draft.map((r, i) => (!locked(r) && dirty(cols, r, base[i]) ? i : -1)).filter(i => i >= 0);

  const edit = (i: number, c: GCol, v: any) => setDraft(d => d.map((r, j) => (j === i ? setv(r, c.k, v) : r)));
  async function saveRows(idx: number[]) {
    setBusy(true); let ok = 0, fail = 0, first = ""; const nb = [...base], ne: Record<number, string> = {};
    for (const i of idx) {
      const out = clean(cols, draft[i]);
      try { await save(out, false); nb[i] = out; ok++; } catch (e: any) { fail++; ne[i] = e.message || String(e); first = first || `${getv(out, cols[0].k)}: ${ne[i]}`; }
    }
    setBase(nb); setDraft(d => d.map((r, j) => (idx.includes(j) && !ne[j] ? nb[j] : r))); setErrs(ne); setBusy(false);
    if (ok) core().then(c => c.S.syncSoon(300));
    toast(fail ? `${ok} tersimpan, ${fail} gagal. ${first}` : `Tersimpan (${ok})`, fail ? "err" : "ok");
    return fail === 0;
  }
  async function add() {
    setBusy(true);
    try { await save(clean(cols, nw), true); toast("Tersimpan"); core().then(c => c.S.syncSoon(300)); reload(); }
    catch (e: any) { toast(e.message || String(e), "err"); setBusy(false); }
  }
  async function act(a: GAction, i: number) {
    const row = base[i]; const msg = a.confirm?.(row);
    if (msg && !await ask(msg, { title: "Konfirmasi", ok: a.danger ? "Lanjut" : "OK", danger: !!a.danger })) return;
    setBusy(true);
    try { const r = await a.run(row); if (r !== false) { toast(a.ok || "Selesai"); core().then(c => c.S.syncSoon(300)); reload(); } else setBusy(false); }
    catch (e: any) { toast(e.message || String(e), "err"); setBusy(false); }
  }
  async function commitOrder(next: any[]) {
    if (next.every((r, i) => r === base[i])) return;
    try { await reorder!(next); setBase(next); setDraft(next); toast("Urutan tersimpan"); core().then(c => c.S.syncSoon(300)); }
    catch (e: any) { toast(e.message || String(e), "err"); reload(); }
  }
  const moveRow = (from: number, to: number) => { if (to < 0 || to >= draft.length || from === to) return draft; const d = [...draft]; const [r] = d.splice(from, 1); d.splice(to, 0, r); return d; };
  const blockedByDirty = () => { if (dirtyIdx.length) { toast("Simpan perubahan di tabel dulu, baru ubah urutan.", "err"); return true; } return false; };
  function startDrag(e: React.PointerEvent, i: number) {
    if (e.button > 0 || blockedByDirty()) return;
    e.preventDefault(); let cur = i; let list = draft; setDrag(i);
    const move = (ev: PointerEvent) => {
      const trs = [...(body.current?.querySelectorAll("tr[data-row]") ?? [])] as HTMLElement[];
      const k = trs.findIndex(t => { const r = t.getBoundingClientRect(); return ev.clientY >= r.top && ev.clientY <= r.bottom; });
      if (k >= 0 && k !== cur) { const d = [...list]; const [r] = d.splice(cur, 1); d.splice(k, 0, r); list = d; cur = k; setDraft(d); setDrag(k); }
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); setDrag(null); commitOrder(list); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  }
  function keyMove(e: React.KeyboardEvent, i: number) {
    if (!["ArrowUp", "ArrowDown"].includes(e.key) || blockedByDirty()) return;
    e.preventDefault(); const to = e.key === "ArrowUp" ? i - 1 : i + 1; const d = moveRow(i, to); if (d === draft) return;
    setDraft(d); commitOrder(d);
    setTimeout(() => (body.current?.querySelectorAll("tr[data-row] .drag")[to] as HTMLElement | undefined)?.focus(), 0);
  }
  function nav(e: React.KeyboardEvent, k: string) {
    const el = e.target as HTMLElement; if (el.tagName === "SELECT" || !["Enter", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    const tr = el.closest("tr")!; if (tr.hasAttribute("data-new")) { if (e.key === "Enter") { e.preventDefault(); add(); } return; }
    e.preventDefault(); const trs = [...(body.current?.querySelectorAll("tr") ?? [])]; let i = trs.indexOf(tr); const step = e.key === "ArrowUp" ? -1 : 1;
    for (i += step; trs[i]; i += step) { const t = trs[i].querySelector(`[data-k="${CSS.escape(k)}"]:not(:disabled)`) as HTMLInputElement | null; if (t) { t.focus(); t.select?.(); break; } }
  }

  const inp = "h-8 w-full min-w-[5.5rem] rounded border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50";
  const cell = (c: GCol, row: any, i: number, isNew: boolean, ro: boolean) => {
    const v = getv(row, c.k); const dis = off(c, row);
    const set = (x: any) => (isNew ? setNw((n: any) => setv(n, c.k, x)) : edit(i, c, x));
    if (ro) {
      if (dis) return <td className="border-b px-3 py-2 text-center text-muted-foreground">–</td>;
      if (c.type === "bool") return <td className="border-b px-3 py-2 text-center">{v ? "✓" : "–"}</td>;
      if (c.type === "select") return <td className="border-b px-3 py-2">{((c.allOptions || c.options || []).find(o => o.v === v) || ({} as any)).t ?? v ?? ""}</td>;
      return <td className={cn("border-b px-3 py-2", c.pk && "font-medium", c.type === "number" && "text-right tabular-nums", c.k === "description" && "min-w-[14rem] text-muted-foreground")}>{v ?? ""}</td>;
    }
    if (c.type === "bool") return <td className="border-b px-3 py-2 text-center"><input type="checkbox" data-k={c.k} checked={!!v} disabled={dis} onChange={e => set(e.target.checked)} onKeyDown={e => nav(e, c.k)} /></td>;
    if (c.type === "select") return <td className="border-b px-2 py-1.5"><select data-k={c.k} className={inp} value={v ?? ""} onChange={e => set(e.target.value)}>{(c.options || []).map(o => <option key={o.v} value={o.v}>{o.t}</option>)}</select></td>;
    const lock = c.pk && !isNew;
    return <td className={cn("border-b px-2 py-1.5", c.wide && "min-w-[16rem]")}><input data-k={c.k} className={cn(inp, lock && "border-transparent bg-transparent font-medium")} type={c.type === "number" ? "number" : "text"} step={c.type === "number" ? "any" : undefined}
      value={v ?? ""} readOnly={lock} tabIndex={lock ? -1 : undefined} placeholder={c.wide ? "Jelaskan artinya…" : undefined}
      onChange={e => set(c.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)} onKeyDown={e => nav(e, c.k)} /></td>;
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>{title} ({rows.length})</CardTitle>
        {canEdit && <Button size="sm" id="saveall" disabled={!dirtyIdx.length || busy} onClick={async () => { if (await saveRows(dirtyIdx)) reload(); }}>{dirtyIdx.length ? `Simpan semua perubahan (${dirtyIdx.length})` : "Simpan semua perubahan"}</Button>}
      </div>
      {help && <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm [&_b]:font-semibold">{help}</div>}
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {canEdit && <p className="text-xs text-muted-foreground">Edit langsung di tabel; baris yang berubah berwarna kuning. Enter / ↑ ↓ pindah baris, Tab pindah kolom. Baris paling bawah (+) untuk data baru.</p>}
      <div className="max-h-[70vh] overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur"><tr>
            <th className="border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground">#</th>
            {dragOn && <th className="w-8 border-b" />}
            {cols.map(c => <th key={c.k} title={c.hint} className="whitespace-nowrap border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{c.label}{c.hint ? " ?" : ""}</th>)}
            {canEdit && <th className="border-b" />}
          </tr></thead>
          <tbody ref={body}>
            {draft.map((r, i) => { const lk = !canEdit || locked(r); const d = !lk && dirty(cols, r, base[i]);
              return (
                <tr key={i} data-row={i} className={cn(d && "bg-[var(--warning-bg)]", errs[i] && "bg-[var(--danger-bg)]", canEdit && lk && "opacity-60", drag === i && "shadow-lg")} title={errs[i]}>
                  <td className="border-b px-3 py-2 text-muted-foreground">{i + 1}</td>
                  {dragOn && <td className="border-b px-1">{lk ? null : <span className="drag inline-grid size-8 cursor-grab place-items-center rounded text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" style={{ touchAction: "none" }} tabIndex={0} role="button" aria-label="Ubah urutan" title="Seret, atau fokus lalu tekan ↑ ↓" onPointerDown={e => startDrag(e, i)} onKeyDown={e => keyMove(e, i)}><GripVertical className="size-4" /></span>}</td>}
                  {cols.map(c => <FragCell key={c.k}>{cell(c, r, i, false, lk)}</FragCell>)}
                  {canEdit && <td className="whitespace-nowrap border-b px-2 py-1.5"><div className="flex gap-1.5">
                    {!lk && <Button size="sm" variant="outline" disabled={busy || !d} data-save onClick={() => saveRows([i])}>Simpan</Button>}
                    {actions.filter(a => !a.show || a.show(base[i])).map(a => <Button key={a.id} size="sm" variant={a.danger ? "destructive" : "outline"} disabled={busy} data-act={a.id} onClick={() => act(a, i)}>{a.label}</Button>)}
                  </div></td>}
                </tr>); })}
            {canEdit && <tr data-new className="bg-muted/30">
              <td className="border-b px-3 py-2 text-muted-foreground">+</td>{dragOn && <td className="border-b" />}
              {cols.map(c => <FragCell key={c.k}>{cell(c, nw, -1, true, false)}</FragCell>)}
              <td className="border-b px-2 py-1.5"><Button size="sm" data-add disabled={busy} onClick={add}>Tambah</Button></td>
            </tr>}
          </tbody>
        </table>
      </div>
      {!rows.length && !canEdit && <p className="text-sm text-muted-foreground">Belum ada data.</p>}
    </Card>
  );
}
const FragCell = ({ children }: { children: React.ReactNode }) => <>{children}</>;
