/* eslint-disable @typescript-eslint/no-explicit-any */
// The offline core (Dexie, outbox sync, validators, config) is shared plain JS from the v2.0 app.
// It touches browser APIs, so it is loaded lazily on the client only.
export type Core = { S: any; D: any; cfg: any; V: any; R: any; conf: any; brand: any; defs: any };
let p: Promise<Core> | null = null;

export function core(): Promise<Core> {
  if (!p) {
    p = (async () => {
      const [S, D, cfg, V, R, conf, brand, defs] = await Promise.all([
        import("./core/sync.js"), import("./core/db.js"), import("./core/cfg.js"), import("./core/validate.js"),
        import("./core/rules.js"), import("./core/config.js"), import("./core/brand.js"), import("./core/defs.js"),
      ]);
      return { S, D, cfg, V, R, conf, brand, defs } as Core;
    })();
  }
  return p;
}

export async function openSite(site: string) {
  const { D, cfg } = await core();
  D.openDb(site);
  await cfg.loadCfg();
}

export type Info = {
  site: string; email: string | null; name: string; role: string; role_label: string;
  can_write: boolean; can_admin: boolean; can_super: boolean; guest?: boolean; forms?: string[] | null;
};
export type SyncStatus = { pending: number; online: boolean; syncing: boolean; error: string | null; last: string | null };

export const canForm = (i: Info | null, f: string) => !!i?.can_write && (!i.forms || i.forms.includes(f));

export const TABS: { key: string; label: string; group: string; icon: string; needs?: string; login?: boolean }[] = [
  { key: "progress", label: "Drilling Progress", group: "Input", icon: "Pickaxe", needs: "progress" },
  { key: "collars", label: "Collar", group: "Input", icon: "MapPin", needs: "collar" },
  { key: "hours", label: "Distribution Hour", group: "Input", icon: "Clock", needs: "hours" },
  { key: "samples", label: "Sampel", group: "Input", icon: "FlaskConical", needs: "sample" },
  { key: "dash", label: "Dashboard", group: "Analisis", icon: "LayoutDashboard", login: true },
  { key: "qc", label: "Data QC", group: "Analisis", icon: "ShieldCheck", login: true },
  { key: "map", label: "Peta", group: "Analisis", icon: "Map", login: true },
  { key: "d3", label: "3D Hole", group: "Analisis", icon: "Box", login: true },
  { key: "import", label: "Import Data", group: "Data", icon: "FileSpreadsheet", needs: "any" },
  { key: "report", label: "Laporan", group: "Data", icon: "FileText" },
  { key: "list", label: "Data Records", group: "Data", icon: "Database" },
  { key: "admin", label: "Pengaturan", group: "Sistem", icon: "Settings", login: true },
];

export function tabsFor(i: Info) {
  return TABS.filter(t => (t.needs === "any" ? ["progress","collar","hours","sample"].some(f => canForm(i, f)) && !i.guest : t.needs ? canForm(i, t.needs) : true) && (t.login ? !i.guest : true));
}
