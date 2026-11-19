"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type Col = {
  k: string; label: string; type: "text" | "enum" | "num" | "date"; get: (r: any) => any;
  show?: (r: any) => string; lab?: (v: any) => string; render?: (r: any) => React.ReactNode; cls?: string;
};
type St = { q: string; f: Record<string, Record<string, string>>; sort: { k: string; dir: 1 | -1 } | null; open: boolean; limit: number };
// search / filters / sort / open state survive a redraw of the page (keyed by `id`)
const STATE = new Map<string, St>();

const cmp = (a: any, b: any) => {
  if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
};
const nn = (v: any) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
const inp = "h-8 w-full min-w-0 rounded border border-input bg-card px-1.5 text-xs outline-none focus-visible:border-ring";

export function RecordList({ id, title, rows, cols, sort, open = true, onOpen, canOpen, select, onShown, note, empty }: {
  id: string; title: string; rows: any[]; cols: Col[]; sort?: { k: string; dir: 1 | -1 }; open?: boolean;
  onOpen?: ((r: any) => void) | null; canOpen?: (r: any) => boolean;
  select?: { set: Set<string>; id: (r: any) => string; onChange?: () => void };
  onShown?: (rows: any[]) => void; note?: React.ReactNode; empty?: string;
}) {
  const init = STATE.get(id) ?? { q: "", f: {}, sort: sort ?? null, open, limit: 100 };
  const [st, setSt] = useState<St>(init);
  const [, bump] = useState(0);
  useEffect(() => { STATE.set(id, st); }, [id, st]);
  const q = useDeferredValue(st.q), fl = useDeferredValue(st.f);

  const text = (c: Col, r: any) => { const v = c.show ? c.show(r) : c.type === "enum" && c.lab ? c.lab(c.get(r)) : c.get(r); return v == null ? "" : String(v); };
  const cur = useMemo(() => {
    const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    const act = cols.filter(c => { const f = fl[c.k]; return f && Object.values(f).some(v => v !== "" && v != null); });
    let out = rows.filter(r => {
      if (toks.length) { const h = cols.map(c => text(c, r)).join(" ").toLowerCase(); if (!toks.every(t => h.includes(t))) return false; }
      for (const c of act) {
        const f = fl[c.k], v = c.get(r);
        if (c.type === "enum") { if (f.v && String(v ?? "") !== f.v) return false; }
        else if (c.type === "num") { const n = nn(v); if (f.min && !(n != null && n >= Number(f.min))) return false; if (f.max && !(n != null && n <= Number(f.max))) return false; }
        else if (c.type === "date") { const d = v ? String(v).slice(0, 10) : ""; if (f.from && !(d && d >= f.from)) return false; if (f.to && !(d && d <= f.to)) return false; }
        else if (f.v && !text(c, r).toLowerCase().includes(String(f.v).toLowerCase())) return false;
      }
      return true;
    });
    if (st.sort) { const c = cols.find(x => x.k === st.sort!.k); if (c) { const d = st.sort.dir; out = out.map((r, i) => [r, i] as const).sort((a, b) => d * cmp(c.get(a[0]), c.get(b[0])) || a[1] - b[1]).map(x => x[0]); } }
    return out;
  }, [rows, cols, q, fl, st.sort]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onShown?.(cur); }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps

  const enumOpts = (c: Col) => {
    const op = [...new Set(rows.map(r => c.get(r)).filter(v => v != null && v !== ""))].sort(cmp).map(v => ({ v: String(v), t: c.lab ? c.lab(v) : String(v) }));
    const cv = st.f[c.k]?.v; if (cv && !op.some(x => x.v === cv)) op.push({ v: cv, t: c.lab ? c.lab(cv) : cv });
    return op;
  };
  const setF = (k: string, p: string, v: string) => setSt(s => ({ ...s, limit: 100, f: { ...s.f, [k]: { ...(s.f[k] ?? {}), [p]: v } } }));
  const fv = (k: string, p: string) => st.f[k]?.[p] ?? "";
  const shown = cur.slice(0, st.limit);
  const canRow = (r: any) => !!onOpen && (!canOpen || canOpen(r));
  const nSel = select ? cur.filter(r => select.set.has(select.id(r))).length : 0;
  const toggleAll = (on: boolean) => { cur.forEach(r => (on ? select!.set.add(select!.id(r)) : select!.set.delete(select!.id(r)))); bump(x => x + 1); select!.onChange?.(); };

  return (
    <details className="reclist group rounded-xl border bg-card shadow-sm" open={st.open} onToggle={e => { const o = (e.target as HTMLDetailsElement).open; setSt(s => (s.open === o ? s : { ...s, open: o })); }} id={`rl-${id}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-[var(--card-pad)] py-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold leading-tight before:h-[1.05em] before:w-1.5 before:rounded-full before:bg-primary">{title} <span className="cnt text-sm font-normal text-muted-foreground">({cur.length === rows.length ? rows.length : `${cur.length} dari ${rows.length}`})</span></h2>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 px-[var(--card-pad)] pb-[var(--card-pad)]">
        <div className="flex gap-2">
          <input type="search" className="rl-q h-[var(--control-h-sm)] min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring" placeholder={`Cari di ${title}…`} value={st.q} autoComplete="off" onChange={e => setSt(s => ({ ...s, q: e.target.value, limit: 100 }))} />
          <button type="button" className="rl-reset h-[var(--control-h-sm)] shrink-0 rounded-md border border-input px-3 text-sm hover:bg-accent" onClick={() => setSt(s => ({ ...s, q: "", f: {}, limit: 100 }))}>Reset filter</button>
        </div>
        {note && <div className="text-xs text-muted-foreground">{note}</div>}
        <div className="max-h-[32rem] overflow-auto rounded-lg border">
          <table className="grid w-full border-collapse text-sm">
            <thead className="sticky top-0 z-[1] bg-muted text-left">
              <tr>
                {select && <th className="w-9 px-2 py-2"><input type="checkbox" className="size-4 accent-[var(--primary)]" aria-label="Pilih semua yang tampil" checked={cur.length > 0 && nSel === cur.length} ref={el => { if (el) el.indeterminate = nSel > 0 && nSel < cur.length; }} onChange={e => toggleAll(e.target.checked)} /></th>}
                {cols.map(c => (
                  <th key={c.k} className="cursor-pointer select-none whitespace-nowrap px-2.5 py-2 text-xs font-semibold text-muted-foreground" onClick={() => setSt(s => ({ ...s, sort: s.sort?.k === c.k ? { k: c.k, dir: (-s.sort.dir) as 1 | -1 } : { k: c.k, dir: 1 } }))}>
                    {c.label}<span aria-hidden>{st.sort?.k === c.k ? (st.sort.dir > 0 ? " ▲" : " ▼") : ""}</span>
                  </th>
                ))}
              </tr>
              <tr className="border-b">
                {select && <th />}
                {cols.map(c => (
                  <th key={c.k} className="px-1.5 pb-2 font-normal">
                    {c.type === "enum" ? (
                      <select className={inp} aria-label={`Filter ${c.label}`} value={fv(c.k, "v")} onChange={e => setF(c.k, "v", e.target.value)}><option value="">Semua</option>{enumOpts(c).map(x => <option key={x.v} value={x.v}>{x.t}</option>)}</select>
                    ) : c.type === "num" ? (
                      <div className="flex gap-1"><input className={inp} type="number" step="any" placeholder="min" aria-label={`${c.label} minimum`} value={fv(c.k, "min")} onChange={e => setF(c.k, "min", e.target.value)} /><input className={inp} type="number" step="any" placeholder="max" aria-label={`${c.label} maksimum`} value={fv(c.k, "max")} onChange={e => setF(c.k, "max", e.target.value)} /></div>
                    ) : c.type === "date" ? (
                      <div className="flex gap-1"><input className={inp} type="date" aria-label={`${c.label} dari`} value={fv(c.k, "from")} onChange={e => setF(c.k, "from", e.target.value)} /><input className={inp} type="date" aria-label={`${c.label} sampai`} value={fv(c.k, "to")} onChange={e => setF(c.k, "to", e.target.value)} /></div>
                    ) : (
                      <input className={inp} type="search" placeholder="cari" aria-label={`Filter ${c.label}`} value={fv(c.k, "v")} onChange={e => setF(c.k, "v", e.target.value)} />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const clk = canRow(r);
                return (
                  <tr key={select ? select.id(r) : (r.id ?? Math.random())} data-row className={cn("border-b last:border-0", clk && "cursor-pointer hover:bg-accent/60")}
                    onClick={e => { if (!clk || (e.target as HTMLElement).closest("input,select,button,a")) return; onOpen!(r); }}>
                    {select && <td className="px-2"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={select.set.has(select.id(r))} onChange={e => { e.target.checked ? select.set.add(select.id(r)) : select.set.delete(select.id(r)); bump(x => x + 1); select.onChange?.(); }} /></td>}
                    {cols.map(c => <td key={c.k} className={cn("whitespace-nowrap px-2.5 py-2", (c.type === "num") && "text-right tabular-nums", c.cls)}>{c.render ? c.render(r) : text(c, r)}</td>)}
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={cols.length + (select ? 1 : 0)} className="px-3 py-4 text-muted-foreground">{rows.length ? "Tidak ada data yang cocok dengan filter." : (empty ?? "Belum ada data.")}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-muted-foreground">
          {cur.length > st.limit ? <>{st.limit} dari {cur.length} baris tampil. <button type="button" className="rounded border border-input px-2 py-1" onClick={() => setSt(s => ({ ...s, limit: s.limit + 200 }))}>Tampilkan lebih banyak</button></> : cur.length && onOpen ? "Ketuk baris untuk membuka." : ""}
        </div>
      </div>
    </details>
  );
}
