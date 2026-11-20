import assert from 'node:assert/strict';
import { minCurvature, pointAt, buildModel, CLASS_COLORS } from '../src/lib/core/geo3d.js';
const near = (a, b, t = 0.01, m = '') => assert.ok(Math.abs(a - b) <= t, `${m} ${a} vs ${b}`);

// vertical hole
let p = minCurvature([{ md: 0, dip: -90, az: 0 }, { md: 50, dip: -90, az: 0 }]);
near(p[1].rl, -50, 1e-6, 'vertical rl'); near(p[1].e, 0, 1e-6); near(p[1].n, 0, 1e-6);
// 45 degrees towards east (az 90)
p = minCurvature([{ md: 0, dip: -45, az: 90 }, { md: 100, dip: -45, az: 90 }]);
near(p[1].e, 70.711, 0.01, 'east'); near(p[1].rl, -70.711, 0.01, 'down'); near(p[1].n, 0, 1e-6);
// north, horizontal
p = minCurvature([{ md: 0, dip: 0, az: 0 }, { md: 30, dip: 0, az: 0 }]);
near(p[1].n, 30, 1e-6); near(p[1].rl, 0, 1e-6);
// curving hole: vertical to 45 deg, shorter than the path length in plan and deeper than straight 45
p = minCurvature([{ md: 0, dip: -90, az: 0 }, { md: 100, dip: -45, az: 0 }]);
assert.ok(p[1].rl < -70.7 && p[1].rl > -100 && p[1].n > 0 && p[1].n < 70.7, JSON.stringify(p[1]));
near(Math.hypot(p[1].n, p[1].rl), 98.1, 1.5, 'chord shorter than arc');
// interpolation
const path = minCurvature([{ md: 0, dip: -90, az: 0 }, { md: 40, dip: -90, az: 0 }]);
near(pointAt(path, 10).rl, -10, 1e-6); near(pointAt(path, 99).rl, -40, 1e-6); near(pointAt(path, -5).rl, 0, 1e-6);

// model
const d = {
  collar: [
    { hole_id: 'A', asbuilt_lat: -3.1, asbuilt_lon: 121.1, asbuilt_elev: 100, total_depth_m: 30, hole_type: 'DD' },
    { hole_id: 'B', planned_lat: -3.1, planned_lon: 121.1005, planned_elev: 120, planned_depth_m: 20, dip_deg: -60, azimuth_deg: 90 },
    { hole_id: 'C', total_depth_m: 20 },                       // no coordinates
    { hole_id: 'D', asbuilt_lat: -3.1, asbuilt_lon: 121.101 }, // no depth
    { hole_id: 'E', asbuilt_lat: -3.2, asbuilt_lon: 121.1, is_deleted: true },
  ],
  survey: [{ hole_id: 'B', depth_m: 10, dip_deg: -58, azimuth_deg: 92 }],
  assay: [
    { hole_id: 'A', sample_type: 'NORMAL', sample_no: 'S1', from_m: 0, to_m: 10, ni_pct: 1.5, fe_pct: 45, mgo_pct: 2 },
    { hole_id: 'A', sample_type: 'NORMAL', sample_no: 'S2', from_m: 10, to_m: 20, ni_pct: 1.8, fe_pct: 12, mgo_pct: 25 },
    { hole_id: 'A', sample_type: 'BLANK', sample_no: 'B1', from_m: null, to_m: null, ni_pct: 0.01 },
  ],
  utm: { zone: 51, hemi: 'S' },
};
const m = buildModel(d);
assert.deepEqual(m.holes.map(h => h.id), ['A', 'B']);
assert.deepEqual(m.skipped.sort(), ['C', 'D']);
const A = m.holes[0], B = m.holes[1];
assert.equal(A.total, 30); assert.equal(A.assumedVertical, true); assert.equal(A.intervals.length, 2);
assert.equal(A.intervals[0].cls, 'LIM'); assert.equal(A.intervals[1].cls, 'RSAP');
assert.ok(CLASS_COLORS.LIM && CLASS_COLORS.BRK);
assert.equal(B.surveyed, true); assert.equal(B.total, 20);
assert.ok(B.e > A.e + 40 && B.e < A.e + 70, 'B is about 55 m east of A: ' + (B.e - A.e));
// scene is centred and Y-up: RL 100 and 120 average to 110
const [x, y, z] = m.toScene(A, A.path[0]);
near(y, -10, 1e-6, 'centred rl'); assert.ok(x < 0 && Math.abs(z) < 1);
const [, y2] = m.toScene(A, A.path[A.path.length - 1]); near(y2, -40, 1e-6, 'goes down');
assert.ok(m.radius >= 30);
// empty
const e = buildModel({ collar: [], survey: [], assay: [] }); assert.equal(e.holes.length, 0);
console.log('geo3d tests passed');
{
  const { segments } = await import('../src/lib/core/geo3d.js');
  const mm = buildModel(d), a = mm.holes[0];
  const sg = segments(mm, a, 'cls', 1);
  assert.equal(sg.length, 3);                                   // 0-10, 10-20, 20-30 (no assay)
  assert.equal(sg[0].color, CLASS_COLORS.LIM); assert.equal(sg[1].color, CLASS_COLORS.RSAP); assert.equal(sg[2].color, null);
  near(sg[2].b[1] - sg[0].a[1], -30, 1e-6, 'segments span the hole');
  assert.equal(segments(mm, a, 'ni', 2)[2].b[1] - segments(mm, a, 'ni', 2)[0].a[1], -60);   // exaggeration on Y
  assert.ok(segments(mm, a, 'ni', 1)[0].color && segments(mm, a, 'mgo', 1)[1].color);
  console.log('segments ok');
}
