/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Col } from "@/components/record-list";
import { r2, t5 } from "@/components/form-kit";

const SYNC_LAB: Record<string, string> = { synced: "synced", pending: "pending", error: "error" };
const chip = (v: string) => (
  <span className={`rounded-full border px-2 py-0.5 text-xs ${v === "error" ? "border-[var(--danger-border)] bg-[var(--danger-bg)] text-danger" : v === "pending" ? "border-[var(--warning-border)] bg-[var(--warning-bg)] text-warning" : "border-[var(--success-border)] bg-[var(--success-bg)] text-success"}`}>{SYNC_LAB[v] || v}</span>
);

// One column set per table, shared by the form pages and Data Records. Needs the loaded cfg (labels) and validate (hoursOf).
export function makeCols(cfg: any, V: any): Record<string, Col[]> {
  const lbl = (l: string) => (v: any) => cfg.labelOf(l, v);
  const T = (k: string, label: string, get: (r: any) => any, extra: Partial<Col> = {}): Col => ({ k, label, type: "text", get, ...extra });
  const N = (k: string, label: string, get: (r: any) => any, extra: Partial<Col> = {}): Col => ({ k, label, type: "num", get, ...extra });
  const DT = (k: string, label: string, get: (r: any) => any, extra: Partial<Col> = {}): Col => ({ k, label, type: "date", get, ...extra });
  const E = (k: string, label: string, get: (r: any) => any, list?: string | null, extra: Partial<Col> = {}): Col => ({ k, label, type: "enum", get, lab: list ? lbl(list) : undefined, ...extra });
  const SYNC: Col = { k: "_sync", label: "Sync", type: "enum", get: r => r._sync, lab: v => SYNC_LAB[v] || v, render: r => chip(r._sync) };
  const pk = { cls: "font-medium" };
  return {
    progress: [DT("work_date", "Tanggal", r => r.work_date), E("shift", "Shift", r => r.shift, "shift"), E("rig_id", "Rig", r => r.rig_id), T("hole_id", "Hole ID", r => r.hole_id, pk),
      N("from_m", "Dari (m)", r => r.from_m), N("to_m", "Sampai (m)", r => r.to_m), N("len", "Meter", r => r2(r.to_m - r.from_m)), E("layer", "Layer", r => r.layer || "", "layer"),
      N("core_len_m", "Core (m)", r => r.core_len_m), N("downtime_hours", "Downtime (jam)", r => r.downtime_hours), E("downtime_reason", "Alasan downtime", r => r.downtime_reason || "", "downtime_reason"),
      T("remarks", "Remarks", r => r.remarks), SYNC],
    collars: [T("hole_id", "Hole ID", r => r.hole_id, pk), E("hole_type", "Tipe", r => r.hole_type, "hole_type"), E("prospect", "Prospect", r => r.prospect || ""),
      E("status", "Status", r => r.status, "collar_status"), N("planned_depth_m", "Planned depth (m)", r => r.planned_depth_m), N("total_depth_m", "Total depth (m)", r => r.total_depth_m),
      E("asbuilt", "As-built", r => (r.asbuilt_lat != null ? "ada" : "belum"), null, { lab: v => (v === "ada" ? "Ada" : "Belum") }), T("remarks", "Remarks", r => r.remarks), SYNC],
    disthours: [DT("work_date", "Tanggal", r => r.work_date), E("rig_id", "Rig", r => r.rig_id), T("from_time", "From", r => t5(r.from_time)), T("to_time", "To", r => t5(r.to_time)),
      N("hrs", "Jam", r => r2(V.hoursOf(r))), E("activity", "Aktivitas", r => r.activity, "activity"),
      N("fuel_l", "Fuel (L)", r => r.fuel_l), N("polymer_l", "Polymer (L)", r => r.polymer_l), N("oil_hyd_l", "Hyd oil (L)", r => r.oil_hyd_l), T("remarks", "Remarks", r => r.remarks), SYNC],
    surveys: [T("hole_id", "Hole ID", r => r.hole_id, pk), N("depth_m", "Depth (m)", r => r.depth_m), N("dip_deg", "Dip (°)", r => r.dip_deg), N("azimuth_deg", "Azimuth (°)", r => r.azimuth_deg),
      E("method", "Metode", r => r.method || ""), DT("survey_date", "Tanggal", r => r.survey_date), T("remarks", "Remarks", r => r.remarks), SYNC],
    samples: [T("sample_no", "No. sampel", r => r.sample_no, pk), T("hole_id", "Hole ID", r => r.hole_id), N("from_m", "Dari (m)", r => r.from_m), N("to_m", "Sampai (m)", r => r.to_m),
      E("sample_type", "Tipe", r => r.sample_type, "sample_type"), E("status", "Status", r => r.status, "sample_status"), DT("sampled_date", "Tgl ambil", r => r.sampled_date), DT("sent_date", "Tgl kirim", r => r.sent_date),
      E("lab", "Lab", r => r.lab || ""), T("batch_id", "Batch", r => r.batch_id), T("remarks", "Remarks", r => r.remarks), SYNC],
    assays: [T("hole_id", "Hole ID", r => r.hole_id, pk), N("from_m", "Dari (m)", r => r.from_m), N("to_m", "Sampai (m)", r => r.to_m), T("sample_no", "No. sampel", r => r.sample_no),
      E("layer", "Layer", r => r.layer || "", "layer"), N("ni_pct", "Ni (%)", r => r.ni_pct), N("co_pct", "Co (%)", r => r.co_pct), N("fe_pct", "Fe (%)", r => r.fe_pct), N("mgo_pct", "MgO (%)", r => r.mgo_pct), N("sio2_pct", "SiO2 (%)", r => r.sio2_pct),
      E("sample_type", "Tipe", r => r.sample_type || "", "sample_type"), T("batch_id", "Batch", r => r.batch_id), E("lab", "Lab", r => r.lab || ""), SYNC],
  };
}

// rows of one table with their sync state (outbox: none = synced, err = error, else pending)
export async function decorated(D: any, tbl: string, rows?: any[]) {
  const [ob, live] = await Promise.all([D.db.outbox.toArray(), rows ? Promise.resolve(rows) : D.db[tbl].filter((x: any) => !x.is_deleted).toArray()]);
  const m = new Map<string, any>(ob.map((o: any) => [o.key, o]));
  return (live as any[]).map(r => { const o = m.get(`${tbl}:${r.id}`); return { ...r, _sync: o ? (o.err ? "error" : "pending") : "synced" }; });
}
