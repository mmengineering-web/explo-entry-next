// Geometry for the 3D drill-hole view. Pure functions, no DOM, no three.js (tested in Node).
// Coordinates: UTM easting/northing from collar lat/lon (as-built, else planned), RL from collar elevation.
// Hole path: minimum curvature through collar dip/azimuth and the survey stations. Dip: -90 = vertical down, 0 = horizontal.
import { latLonToUtm, zoneOf } from './utm.js';
import { classify, valuesOf, thresholds } from './qc/calc.js';

const rad = d => (d * Math.PI) / 180;
const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));

// Laterite profile classes as one earth hue, light (limonite, top) to dark (bedrock, bottom). No rainbow.
export const CLASS_COLORS = { LIM: '#f0c391', CEK: '#d89a5b', SAP: '#b8703a', RSAP: '#8a4f27', BRK: '#5a331c' };
export const CLASS_ORDER = ['LIM', 'CEK', 'SAP', 'RSAP', 'BRK'];

// stations: [{ md, dip, az }] sorted by md, first at md 0. Returns [{ md, e, n, rl }] relative to the collar (0,0,0).
export function minCurvature(stations) {
  const out = [{ md: stations[0].md, e: 0, n: 0, rl: 0 }];
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1], b = stations[i], d = b.md - a.md, p = out[i - 1];
    if (d <= 0) continue;
    const i1 = rad(90 + a.dip), i2 = rad(90 + b.dip), a1 = rad(a.az), a2 = rad(b.az);
    const cosDL = Math.min(1, Math.max(-1, Math.cos(i2 - i1) - Math.sin(i1) * Math.sin(i2) * (1 - Math.cos(a2 - a1))));
    const dl = Math.acos(cosDL), rf = dl < 1e-6 ? 1 : (2 / dl) * Math.tan(dl / 2);
    out.push({
      md: b.md,
      n: p.n + (d / 2) * (Math.sin(i1) * Math.cos(a1) + Math.sin(i2) * Math.cos(a2)) * rf,
      e: p.e + (d / 2) * (Math.sin(i1) * Math.sin(a1) + Math.sin(i2) * Math.sin(a2)) * rf,
      rl: p.rl - (d / 2) * (Math.cos(i1) + Math.cos(i2)) * rf,
    });
  }
  return out;
}

// Position at a measured depth, linear between path stations.
export function pointAt(path, md) {
  if (md <= path[0].md) return path[0];
  const last = path[path.length - 1];
  if (md >= last.md) return last;
  for (let i = 1; i < path.length; i++) if (md <= path[i].md) {
    const a = path[i - 1], b = path[i], t = (md - a.md) / (b.md - a.md || 1);
    return { md, e: a.e + (b.e - a.e) * t, n: a.n + (b.n - a.n) * t, rl: a.rl + (b.rl - a.rl) * t };
  }
  return last;
}

// d: { collar, survey, assay, setting, utm } as returned by the QC loader. Returns everything the scene needs.
export function buildModel(d) {
  const T = thresholds(d.setting);
  const zone = num(d.utm?.zone), hemi = d.utm?.hemi || 'S';
  const svBy = new Map(), asBy = new Map();
  for (const s of d.survey || []) if (!s.is_deleted && s.hole_id && num(s.depth_m) != null) (svBy.get(s.hole_id) || svBy.set(s.hole_id, []).get(s.hole_id)).push(s);
  for (const a of d.assay || []) if (!a.is_deleted && a.sample_type === 'NORMAL' && a.hole_id && num(a.from_m) != null && num(a.to_m) != null) (asBy.get(a.hole_id) || asBy.set(a.hole_id, []).get(a.hole_id)).push(a);

  const holes = [], skipped = [];
  for (const c of d.collar || []) {
    if (c.is_deleted) continue;
    const lat = num(c.asbuilt_lat ?? c.planned_lat), lon = num(c.asbuilt_lon ?? c.planned_lon);
    if (lat == null || lon == null) { skipped.push(c.hole_id); continue; }
    const u = latLonToUtm(lat, lon, zone || zoneOf(lon), zone ? hemi : (lat < 0 ? 'S' : 'N'));
    const rl0 = num(c.asbuilt_elev ?? c.planned_elev) ?? 0;
    const svs = (svBy.get(c.hole_id) || []).map(s => ({ md: num(s.depth_m), dip: num(s.dip_deg) ?? -90, az: num(s.azimuth_deg) ?? 0 })).filter(s => s.md > 0).sort((a, b) => a.md - b.md);
    const ivs = (asBy.get(c.hole_id) || []).sort((a, b) => num(a.from_m) - num(b.from_m));
    const lastIv = ivs.length ? num(ivs[ivs.length - 1].to_m) : 0;
    const total = Math.max(num(c.total_depth_m) ?? num(c.planned_depth_m) ?? 0, svs.length ? svs[svs.length - 1].md : 0, lastIv);
    if (!(total > 0)) { skipped.push(c.hole_id); continue; }
    const st = [{ md: 0, dip: num(c.dip_deg) ?? -90, az: num(c.azimuth_deg) ?? 0 }, ...svs];
    if (st[st.length - 1].md < total) st.push({ ...st[st.length - 1], md: total });
    const path = minCurvature(st);
    const intervals = ivs.map(a => {
      const v = valuesOf(a), from = num(a.from_m), to = num(a.to_m);
      return { sample: a.sample_no, from, to, ni: v.Ni, fe: v.Fe, mgo: v.MgO, cls: classify(v.Ni, v.Fe, v.MgO, T) };
    });
    holes.push({ id: c.hole_id, type: c.hole_type, status: c.status, prospect: c.prospect, e: u.e, n: u.n, rl: rl0, total, path, intervals, surveyed: svs.length > 0, assumedVertical: c.dip_deg == null && !svs.length });
  }
  // Centre the scene on the collars so single-precision floats keep metre accuracy.
  const e0 = holes.length ? holes.reduce((s, h) => s + h.e, 0) / holes.length : 0;
  const n0 = holes.length ? holes.reduce((s, h) => s + h.n, 0) / holes.length : 0;
  const r0 = holes.length ? holes.reduce((s, h) => s + h.rl, 0) / holes.length : 0;
  let radius = 10;
  for (const h of holes) for (const p of h.path) radius = Math.max(radius, Math.hypot(h.e + p.e - e0, h.n + p.n - n0, h.rl + p.rl - r0));
  // Scene space is Y-up: x = easting, y = RL, z = -northing.
  const toScene = (h, p) => [h.e + p.e - e0, h.rl + p.rl - r0, -(h.n + p.n - n0)];
  return { holes, skipped, origin: { e: e0, n: n0, rl: r0 }, radius, toScene, T };
}

// Sample value per colour mode. Returns a CSS colour or null (no value).
const RAMP = ['#f6e3c8', '#e8bd85', '#d4924f', '#b06a2c', '#7f4519', '#4a2a12'];
export function rampColor(t) { return RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1))))]; }
export const MODES = {
  cls: { label: 'Class', pick: iv => (iv.cls ? CLASS_COLORS[iv.cls] : null) },
  ni: { label: 'Ni %', max: 2.5, pick: iv => (iv.ni == null ? null : rampColor(iv.ni / 2.5)) },
  fe: { label: 'Fe %', max: 50, pick: iv => (iv.fe == null ? null : rampColor(iv.fe / 50)) },
  mgo: { label: 'MgO %', max: 40, pick: iv => (iv.mgo == null ? null : rampColor(iv.mgo / 40)) },
};

// Coloured pieces of one hole, in scene space (Y-up, metres, vertical exaggeration applied to Y). A piece is one run
// between two measured depths. color is null where the hole has no assay value for the chosen mode.
export function segments(model, h, mode = 'cls', exag = 1) {
  const pick = (MODES[mode] || MODES.cls).pick, set = new Set([0, h.total]);
  for (const p of h.path) set.add(Math.min(p.md, h.total));
  for (const iv of h.intervals) { set.add(Math.max(0, Math.min(h.total, iv.from))); set.add(Math.max(0, Math.min(h.total, iv.to))); }
  const mds = [...set].sort((a, b) => a - b), out = [];
  const at = md => { const s = model.toScene(h, pointAt(h.path, md)); return [s[0], s[1] * exag, s[2]]; };
  for (let i = 1; i < mds.length; i++) {
    const m0 = mds[i - 1], m1 = mds[i], mid = (m0 + m1) / 2, iv = h.intervals.find(x => x.from <= mid && mid < x.to);
    out.push({ a: at(m0), b: at(m1), from: m0, to: m1, color: iv ? pick(iv) : null, iv: iv || null });
  }
  return out;
}
