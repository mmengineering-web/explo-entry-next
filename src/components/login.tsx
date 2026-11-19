"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { LogIn, MountainSnow, Moon, Sun } from "lucide-react";
import { core, openSite, type Info } from "@/lib/boot";
import { useTheme } from "@/lib/ui-state";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function Login({ onDone, lockedSite }: { onDone: (i: Info) => void; lockedSite?: string | null }) {
  const [sites, setSites] = useState<string[]>([]);
  const [svg, setSvg] = useState("");
  const [site, setSite] = useState(lockedSite || "WKM");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const hero = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    core().then(c => { setSites(Object.keys(c.conf.SITES)); setSvg(c.brand.strataHero()); });
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // pointer parallax on the scene (desktop, motion allowed)
  useEffect(() => {
    const el = hero.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(hover: hover)").matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--px", String(((e.clientX - r.left) / r.width - 0.5) * 2));
      el.style.setProperty("--py", String(((e.clientY - r.top) / r.height - 0.5) * 2));
    };
    const leave = () => { el.style.setProperty("--px", "0"); el.style.setProperty("--py", "0"); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, []);

  const tags = useMemo(() => ["Collar", "Progress", "Jam rig", "Sampel"], []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) { setMsg("Tidak ada internet. Login baru bisa saat online."); return; }
    setBusy(true); setMsg("");
    try {
      const { S } = await core();
      const info = await S.login(site, email.trim(), pw);
      await openSite(info.site);
      onDone(info);
    } catch (err) {
      setMsg((err as Error)?.message || "Login gagal.");
    } finally { setBusy(false); }
  }
  async function guest() {
    const { S } = await core();
    const info = S.enterGuest(site);
    await openSite(site);
    onDone(info);
  }

  return (
    <div className="login-wrap">
      <div className="login-hero" ref={hero}>
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="hero-copy">
          <h2 style={{ ["--i" as string]: 0 }}>Catat bor di lapangan. Kirim saat ada sinyal.</h2>
          <p style={{ ["--i" as string]: 1 }}>Data aman di HP lebih dulu, lalu terkirim ke database site Anda.</p>
          <ul className="hero-tags" style={{ ["--i" as string]: 2 }}>{tags.map(t => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
      <div className="login-pane">
        <Card className="login w-full max-w-[26rem]">
          <div className="flex items-center gap-3">
            <span className="grid size-[2.6rem] place-items-center rounded-[.7rem] bg-gradient-to-br from-[color-mix(in_srgb,var(--primary)_82%,#fff)] to-primary text-primary-foreground shadow-sm">
              <MountainSnow className="size-[22px]" aria-hidden />
            </span>
            <div><h1 className="text-lg font-semibold leading-tight">Exploration Data Entry</h1><p className="text-sm text-muted-foreground">CAN · offline-first</p></div>
          </div>
          {!online && <div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-warning">Offline. Login belum bisa, tapi Anda tetap bisa input tanpa login.</div>}
          <form onSubmit={submit} className="flex flex-col gap-4" id="lf">
            <label className="flex flex-col gap-1.5 text-sm font-medium"><span>Site</span>
              <Select value={site} onChange={e => setSite(e.target.value)} disabled={!!lockedSite} id="l-site">{(sites.length ? sites : [site]).map(s => <option key={s}>{s}</option>)}</Select></label>
            <label className="flex flex-col gap-1.5 text-sm font-medium"><span>Email</span>
              <Input id="l-email" type="email" autoComplete="username" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label className="flex flex-col gap-1.5 text-sm font-medium"><span>Password</span>
              <Input id="l-pw" type="password" autoComplete="current-password" required value={pw} onChange={e => setPw(e.target.value)} /></label>
            {msg && <div role="alert" className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-danger" id="l-msg">{msg}</div>}
            <Button type="submit" size="lg" className="w-full" disabled={busy || !online} id="l-go"><LogIn />Masuk</Button>
          </form>
          <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />atau<span className="h-px flex-1 bg-border" /></div>
          <Button type="button" variant="outline" className="w-full" onClick={guest} id="l-guest">Input tanpa login (offline)</Button>
          <p className="text-sm text-muted-foreground">Login perlu internet. Tanpa sinyal, pilih <b>Input tanpa login</b>: data tersimpan di HP dan terkirim otomatis setelah Anda login.</p>
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Ikon: Lucide · Font: Geist</span>
            <Button type="button" variant="ghost" size="icon" onClick={toggle} aria-label="Ganti tema">{theme === "dark" ? <Sun /> : <Moon />}</Button></div>
        </Card>
      </div>
    </div>
  );
}
