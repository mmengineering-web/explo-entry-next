"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Camera, Image as ImageIcon } from "lucide-react";
import { core } from "@/lib/boot";
import { cn } from "@/lib/utils";
import { useToast } from "./toast";

export const today = () => new Date().toLocaleDateString("sv-SE");
export const num = (v: string) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
export const txt = (v: string) => (v == null || v.trim() === "" ? null : v.trim());
export const s = (v: any) => (v == null ? "" : String(v));
export const r2 = (x: any) => (x == null || x === "" || isNaN(Number(x)) ? null : Math.round(Number(x) * 100) / 100);
export const t5 = (t: any) => String(t || "").slice(0, 5);

export function Field({ label, children, className, hint }: { label: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5 text-sm font-medium", className)}>
      <span className="lbl">{label}</span>{children}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

// A rule-driven block: collapses with a grid-row transition and becomes inert when closed (values are never cleared).
export function Dyn({ open, children, id }: { open: boolean; children: React.ReactNode; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = ref.current; if (el) (el as any).inert = !open; }, [open]);
  return <div ref={ref} id={id} className="dyn" data-open={open} aria-hidden={!open}><div className="dyn-in"><div className="flex flex-col gap-4 pb-px">{children}</div></div></div>;
}

export function Msgs({ errors, warns }: { errors: string[]; warns: string[] }) {
  return (
    <div id="msgs" className="flex flex-col gap-2" aria-live="polite">
      {errors.map(m => <div key={m} className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-danger">{m}</div>)}
      {warns.map(m => <div key={m} className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-warning">{m}</div>)}
    </div>
  );
}

const fileBtn = "inline-flex h-[var(--control-h)] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-card px-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent";

// Photo picker: compresses to JPEG (settings.photo_max_px) and previews. `existing` previews a stored photo (local copy, else signed URL).
export function usePhoto() {
  const toast = useToast();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const pick = useCallback(async (file?: File) => {
    if (!file) return;
    try {
      const { cfg } = await core();
      const px = cfg.setting("photo_max_px");
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, px / Math.max(bmp.width, bmp.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
      cv.getContext("2d")!.drawImage(bmp, 0, 0, cv.width, cv.height);
      const b: Blob | null = await new Promise(res => cv.toBlob(res, "image/jpeg", 0.8));
      if (!b) throw new Error("x");
      setBlob(b); setUrl(u => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(b); });
    } catch { toast("Gagal memproses foto", "err"); }
  }, [toast]);
  const reset = useCallback(() => { setBlob(null); setUrl(null); }, []);
  return { blob, url, pick, reset };
}

export function PhotoField({ label, name, ph, rec }: { label: string; name: string; ph: ReturnType<typeof usePhoto>; rec?: { id: string; photo_path: string | null } | null }) {
  const [old, setOld] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null, dead = false;
    setOld(null);
    if (rec?.photo_path) core().then(async ({ D, S }) => {
      const p = await D.db.photos.get(rec.id);
      if (p?.blob) u = URL.createObjectURL(p.blob);
      else { try { u = await S.signedPhotoUrl(rec.photo_path); } catch { u = null; } }
      if (!dead) setOld(u);
    });
    return () => { dead = true; if (u && u.startsWith("blob:")) URL.revokeObjectURL(u); };
  }, [rec?.id, rec?.photo_path]);
  const shown = ph.url ?? old;
  return (
    <div className="flex flex-col gap-2"><span className="text-sm font-medium">{label}</span>
      <div className="grid grid-cols-2 gap-3">
        <label className={fileBtn}><Camera className="size-4" />Ambil foto (kamera)<input id="photo-cam" type="file" accept="image/*" capture="environment" hidden onChange={e => { ph.pick(e.target.files?.[0]); e.target.value = ""; }} /></label>
        <label className={fileBtn}><ImageIcon className="size-4" />Pilih dari galeri / file<input id="photo" type="file" accept="image/*" hidden onChange={e => { ph.pick(e.target.files?.[0]); e.target.value = ""; }} /></label>
      </div>
      <div className="text-xs text-muted-foreground" id="pname">{name}</div>
      {shown && <motion.img initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} src={shown} alt={label} className="max-h-48 w-fit rounded-lg border object-cover" />}
      {ph.blob && <div className="text-xs text-muted-foreground">Siap disimpan ({Math.round(ph.blob.size / 1024)} KB)</div>}
    </div>
  );
}

export function FormActions({ isEdit, onCancel, onDelete, warnMode, onForce }: { isEdit: boolean; onCancel: () => void; onDelete: () => void; warnMode?: boolean; onForce?: () => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {warnMode ? <button type="button" onClick={onForce} id="b-force" className="inline-flex h-[var(--control-h-lg)] flex-1 items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-foreground">Tetap simpan</button>
        : <button type="submit" id="b-save" className="inline-flex h-[var(--control-h-lg)] flex-1 items-center justify-center rounded-md bg-gradient-to-b from-[color-mix(in_srgb,var(--primary)_86%,#fff)] to-primary px-6 text-base font-medium text-primary-foreground shadow-sm transition active:scale-[.985]">Simpan</button>}
      {isEdit && <>
        <button type="button" onClick={onCancel} id="b-cancel" className="inline-flex h-[var(--control-h-lg)] items-center rounded-md border border-input bg-card px-5 text-base font-medium">Batal</button>
        <button type="button" onClick={onDelete} id="b-del" className="inline-flex h-[var(--control-h-lg)] items-center rounded-md bg-destructive px-5 text-base font-medium text-destructive-foreground">Hapus</button>
      </>}
    </div>
  );
}
