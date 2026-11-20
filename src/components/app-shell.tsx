"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Box, Clock, Database, Ellipsis, FileSpreadsheet, FileText, FlaskConical, Layers, LayoutDashboard, LogOut, Map as MapIcon, MapPin, Moon,
  Pickaxe, RefreshCw, Search, Settings, ShieldCheck, Sun, Wifi, WifiOff,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { core, openSite, tabsFor, TABS, type Info, type SyncStatus } from "@/lib/boot";
import { useTheme } from "@/lib/ui-state";
import { Login } from "./login";
import { BrandMark } from "./brand-mark";
import { ToastProvider, useToast } from "./toast";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Button } from "./ui/button";
import { ProgressForm } from "./progress-form";
import { Soon } from "./soon";
import { CollarForm } from "./collar-form";
import { HoursForm } from "./hours-form";
import { SampleForm } from "./sample-form";
import { ConfirmProvider } from "./confirm";
import { ReportView } from "./report-view";
import { DataRecords } from "./data-records";
import { ImportView } from "./import-view";
import { AdminView } from "./admin-view";
import { DashboardView } from "./dashboard-view";
import { QcView } from "./qc-view";
import { MapView } from "./map-view";
import { Drill3dView } from "./drill3d-view";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  AlertTriangle, Box, Clock, Database, FileSpreadsheet, FileText, FlaskConical, Layers, LayoutDashboard, Map: MapIcon, MapPin, Pickaxe, RefreshCw, Settings, ShieldCheck, Wifi, WifiOff,
};
const Ico = ({ name, className }: { name: string; className?: string }) => {
  const C = ICONS[name] ?? Layers;
  return <C className={className} />;
};

// A new service worker takes over right after a release. The open page still runs the old code, so ask for a reload.
function UpdateWatcher() {
  const toast = useToast();
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;   // first install: nothing to replace
    const on = () => toast("A new version is ready. Close and reopen the app (or reload) to use it.");
    navigator.serviceWorker.addEventListener("controllerchange", on);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", on);
  }, [toast]);
  return null;
}

export function AppShell() {
  const [info, setInfo] = useState<Info | null | undefined>(undefined);
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(console.warn);
  }, []);
  useEffect(() => {
    (async () => {
      const { S } = await core();
      const i = await S.restore();
      if (i) await openSite(i.site);
      setInfo(i || null);
    })().catch(() => setInfo(null));
  }, []);

  if (info === undefined) return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground" aria-busy>Memuat…</div>;
  return (
    <ToastProvider><ConfirmProvider>
      <UpdateWatcher />
      {info ? <Main info={info} onLogout={() => setInfo(null)} /> : <Login onDone={setInfo} />}
    </ConfirmProvider></ToastProvider>
  );
}

function Main({ info, onLogout }: { info: Info; onLogout: () => void }) {
  const tabs = useMemo(() => tabsFor(info), [info]);
  const [tab, setTab] = useState(tabs[0]?.key ?? "report");
  const [pal, setPal] = useState(false);
  const [st, setSt] = useState<SyncStatus>({ pending: 0, online: true, syncing: false, error: null, last: null });
  const { theme, toggle: toggleTheme } = useTheme();
  const chipKey = `${st.online}-${st.syncing}-${st.pending}-${!!st.error}`;

  useEffect(() => {
    let off = () => {};
    core().then(({ S }) => {
      off = S.onStatus(setSt);
      S.startAutoSync();
      S.refreshStatus();
      if (!info.guest) S.syncNow();
    });
    return () => off();
  }, [info.guest]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPal(p => !p); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const logout = useCallback(async () => {
    const { S, D } = await core();
    await S.logout();
    try { await D.purgeServerData(); } catch {}
    onLogout();
  }, [onLogout]);

  const go = (k: string) => { setTab(k); setPal(false); window.scrollTo({ top: 0 }); };
  const groups = useMemo(() => {
    const m = new Map<string, typeof tabs>();
    tabs.forEach(t => m.set(t.group, [...(m.get(t.group) ?? []), t]));
    return [...m.entries()];
  }, [tabs]);
  const cur = TABS.find(t => t.key === tab);

  const chip = st.error ? { t: "error sync", s: "error", c: "text-danger border-[var(--danger-border)] bg-[var(--danger-bg)]", i: "AlertTriangle" }
    : !st.online ? { t: `offline · ${st.pending} menunggu`, s: st.pending ? `${st.pending} menunggu` : "offline", c: "text-warning border-[var(--warning-border)] bg-[var(--warning-bg)]", i: "WifiOff" }
    : st.syncing ? { t: "mengirim…", s: "kirim…", c: "text-info border-[var(--info-border)] bg-[var(--info-bg)]", i: "RefreshCw" }
    : { t: `online · ${st.pending} pending`, s: st.pending ? `${st.pending} pending` : "online", c: "text-success border-[var(--success-border)] bg-[var(--success-bg)]", i: "Wifi" };

  return (
    <div className="min-h-dvh lg:pl-[var(--side-w)]">
      {/* sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-[20] hidden w-[var(--side-w)] flex-col gap-1 overflow-y-auto border-r bg-card p-3 lg:flex" aria-label="Navigasi">
        <div className="flex items-center gap-3 px-2 pb-4 pt-1"><BrandMark /><div><div className="text-[.9375rem] font-semibold leading-tight">Explo Entry</div><div className="text-xs text-muted-foreground">{info.site}</div></div></div>
        {groups.map(([g, items]) => (
          <div key={g} className="flex flex-col gap-0.5">
            <div className="px-2 pb-1 pt-3 text-[.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">{g}</div>
            {items.map(t => (
              <button key={t.key} data-t={t.key} aria-current={t.key === tab ? "page" : undefined} onClick={() => go(t.key)}
                className={cn("relative flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", t.key === tab && "bg-accent font-semibold text-foreground")}>
                {t.key === tab && <motion.span layoutId="nav-mark" className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />}
                <Ico name={t.icon} className={cn("size-4", t.key === tab && "text-brand")} />{t.label}
              </button>
            ))}
          </div>
        ))}
        <div className="mt-auto flex flex-col gap-2 border-t pt-3">
          <div className="flex items-center gap-2 px-1"><span className="grid size-8 place-items-center rounded-full bg-muted text-xs font-semibold">{(info.name || "?").slice(0, 2).toUpperCase()}</span>
            <div className="min-w-0 text-sm leading-tight"><div className="truncate font-medium">{info.name}</div><div className="truncate text-xs text-muted-foreground">{info.site} · {info.role_label}</div></div></div>
          <Button variant="outline" size="sm" onClick={logout}><LogOut />{info.guest ? "Ke halaman login" : "Keluar"}</Button>
        </div>
      </aside>

      {/* top bar */}
      <header className="sticky top-0 z-[20] flex h-[var(--topbar-h)] items-center gap-3 border-b bg-[color-mix(in_srgb,var(--card)_92%,transparent)] px-4 backdrop-blur" style={{ paddingTop: "var(--safe-t)" }}>
        <span className="absolute inset-x-0 -bottom-px h-0.5 origin-left bg-[image:var(--strata-stripe)] [animation:m-stripe_var(--dur-4)_var(--ease-out)_both]" />
        <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden"><BrandMark className="size-8 shrink-0" /><div className="min-w-0 text-sm leading-tight"><div className="truncate font-semibold">{info.site}</div><div className="truncate text-xs text-muted-foreground">{info.name}</div></div></div>
        <h1 className="hidden text-base font-semibold lg:block">{cur?.label}</h1>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <motion.span key={chipKey} initial={{ scale: 0.92, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className={cn("mr-1 inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium", chip.c)} id="sync-chip"><Ico name={chip.i} className={cn("size-3", st.syncing && "animate-spin")} /><span className="sm:hidden">{chip.s}</span><span className="hidden sm:inline">{chip.t}</span></motion.span>
          <Button variant="ghost" size="sm" onClick={() => setPal(true)} aria-label="Cari atau buka perintah" id="b-pal"><Search /><kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[.6875rem] text-muted-foreground sm:inline">Ctrl K</kbd></Button>
          {!info.guest && <Button variant="ghost" size="icon" onClick={() => core().then(c => c.S.syncNow())} aria-label="Sync sekarang"><RefreshCw /></Button>}
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Ganti tema">{theme === "dark" ? <Sun /> : <Moon />}</Button>
        </div>
      </header>

      {/* content */}
      <main className="mx-auto w-full max-w-[var(--content-max)] px-4 pb-[calc(var(--tabbar-h)+var(--safe-b)+1.5rem)] pt-5 lg:pb-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} data-tab={tab} id="view">
            {tab === "progress" ? <ProgressForm info={info} tick={`${st.last}-${st.pending}`} />
              : tab === "collars" ? <CollarForm info={info} tick={`${st.last}-${st.pending}`} />
              : tab === "hours" ? <HoursForm info={info} tick={`${st.last}-${st.pending}`} />
              : tab === "samples" ? <SampleForm info={info} tick={`${st.last}-${st.pending}`} />
              : tab === "import" ? <ImportView info={info} tick={`${st.last}-${st.pending}`} />
              : tab === "admin" ? <AdminView info={info} />
              : tab === "map" ? <MapView info={info} />
              : tab === "d3" ? <Drill3dView info={info} />
              : tab === "qc" ? <QcView info={info} />
              : tab === "dash" ? <DashboardView info={info} />
              : tab === "report" ? <ReportView info={info} tick={`${st.last}-${st.pending}`} />
              : tab === "list" ? <DataRecords info={info} tick={`${st.last}-${st.pending}`} go={go} />
              : <Soon label={cur?.label ?? ""} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* tab bar (phone) */}
      <nav className="fixed inset-x-0 bottom-0 z-[20] flex h-[calc(var(--tabbar-h)+var(--safe-b))] items-stretch border-t bg-card pb-[var(--safe-b)] lg:hidden" aria-label="Tab">
        {tabs.slice(0, 4).map(t => (
          <button key={t.key} onClick={() => go(t.key)} aria-current={t.key === tab ? "page" : undefined} aria-label={t.label}
            className={cn("flex flex-1 flex-col items-center justify-center gap-1 text-[.6875rem] font-medium text-muted-foreground", t.key === tab && "text-foreground")}>
            <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", t.key === tab && "bg-[color-mix(in_srgb,var(--primary)_16%,var(--card))] text-brand")}><Ico name={t.icon} className="size-5" /></span>
            {t.label.split(" ")[0]}
          </button>
        ))}
        <button onClick={() => setPal(true)} className="flex flex-1 flex-col items-center justify-center gap-1 text-[.6875rem] font-medium text-muted-foreground" aria-label="Lainnya">
          <span className="grid h-7 w-12 place-items-center rounded-full"><Ellipsis className="size-5" /></span>Lainnya
        </button>
      </nav>

      <CommandDialog open={pal} onOpenChange={setPal}>
        <CommandInput placeholder="Cari tab atau perintah…" />
        <CommandList>
          <CommandEmpty>Tidak ada hasil.</CommandEmpty>
          {groups.map(([g, items]) => (
            <CommandGroup key={g} heading={g}>
              {items.map(t => <CommandItem key={t.key} value={`${t.label} ${g}`} onSelect={() => go(t.key)}><Ico name={t.icon} />{t.label}{t.key === tab && <span className="ml-auto text-xs text-muted-foreground">dibuka</span>}</CommandItem>)}
            </CommandGroup>
          ))}
          <CommandGroup heading="Aksi">
            {!info.guest && <CommandItem value="sync sekarang" onSelect={() => { core().then(c => c.S.syncNow()); setPal(false); }}><RefreshCw />Sync sekarang</CommandItem>}
            <CommandItem value="ganti tema gelap terang" onSelect={() => { toggleTheme(); setPal(false); }}><Moon />Ganti tema</CommandItem>
            <CommandItem value="keluar logout" onSelect={() => { setPal(false); logout(); }}><LogOut />Keluar</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
