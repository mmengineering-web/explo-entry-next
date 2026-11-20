"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { segments } from "@/lib/core/geo3d.js";
import { useThemeKey } from "./chart-card";

const UP = new THREE.Vector3(0, 1, 0);
const NEUTRAL = "#8a8178"; // sections with no assay value for the chosen colour mode

// One merged mesh per hole: short cylinders along the path, each with a vertex colour. One draw call a hole.
function holeGeometry(segs: any[], r: number) {
  const parts: THREE.BufferGeometry[] = [], col = new THREE.Color();
  for (const s of segs) {
    const a = new THREE.Vector3(...(s.a as [number, number, number])), b = new THREE.Vector3(...(s.b as [number, number, number])), len = a.distanceTo(b);
    if (len < 1e-4) continue;
    const g = new THREE.CylinderGeometry(r, r, len, 6, 1, false);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
    col.set(s.color || NEUTRAL);
    const n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    parts.push(g);
  }
  if (!parts.length) return null;
  const merged = mergeGeometries(parts); parts.forEach(p => p.dispose());
  return merged;
}

function labelTexture(text: string) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 128;
  const x = c.getContext("2d")!; x.font = "600 58px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.lineWidth = 12; x.lineJoin = "round"; x.strokeStyle = "rgba(0,0,0,.8)"; x.strokeText(text, 256, 64); x.fillStyle = "#fff"; x.fillText(text, 256, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function Label({ text, position, width }: { text: string; position: [number, number, number]; width: number }) {
  const tex = useMemo(() => labelTexture(text), [text]);
  useEffect(() => () => tex.dispose(), [tex]);
  return <sprite position={position} scale={[width, width / 4, 1]}><spriteMaterial map={tex} depthTest={false} transparent /></sprite>;
}

function Hole({ model, h, mode, exag, r, selected, labels, onPick }: any) {
  const segs = useMemo(() => segments(model, h, mode, exag), [model, h, mode, exag]);
  const geo = useMemo(() => holeGeometry(segs, selected ? r * 2.4 : r), [segs, r, selected]);
  useEffect(() => () => { geo?.dispose(); }, [geo]);
  if (!geo || !segs.length) return null;
  const top = segs[0].a as [number, number, number];
  return (
    <group>
      <mesh geometry={geo} onClick={e => { e.stopPropagation(); onPick(h.id); }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
        <meshStandardMaterial vertexColors roughness={0.65} metalness={0} emissive={selected ? "#ffffff" : "#000000"} emissiveIntensity={selected ? 0.18 : 0} />
      </mesh>
      <mesh position={top}><sphereGeometry args={[r * 2.6, 10, 8]} /><meshStandardMaterial color={selected ? "#ffffff" : "#d6cfc7"} roughness={0.5} /></mesh>
      {(labels || selected) && <Label text={h.id} position={[top[0], top[1] + r * 10, top[2]]} width={Math.max(r * 70, 12)} />}
    </group>
  );
}

function Controls({ view, resetKey }: { view: { target: [number, number, number]; dist: number }; resetKey: number }) {
  const { camera, gl, invalidate } = useThree();
  const ref = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement); ref.current = c;
    const redraw = () => invalidate(); // demand rendering: draw only when the camera moves
    c.addEventListener("change", redraw); c.enableDamping = false; c.screenSpacePanning = true;
    return () => { c.removeEventListener("change", redraw); c.dispose(); ref.current = null; };
  }, [camera, gl, invalidate]);
  useEffect(() => {
    const [tx, ty, tz] = view.target, d = view.dist;
    camera.position.set(tx + d * 0.75, ty + d * 0.55, tz + d * 0.9);
    (camera as THREE.PerspectiveCamera).near = Math.max(0.1, d / 500); (camera as THREE.PerspectiveCamera).far = d * 30; camera.updateProjectionMatrix();
    ref.current?.target.set(tx, ty, tz); ref.current?.update(); invalidate();
  }, [camera, view, resetKey, invalidate]);
  return null;
}

const nice = (v: number) => { const p = 10 ** Math.floor(Math.log10(v)), f = v / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };

export default function DrillScene({ model, holes, mode, exag, selected, labels, low, resetKey, onPick }: any) {
  const tk = useThemeKey();
  const r = Math.max(0.35, model.radius / 170);
  const { view, gridY, size, step } = useMemo(() => {
    let minY = Infinity, maxY = -Infinity;
    for (const h of model.holes) for (const p of h.path) { const y = model.toScene(h, p)[1] * exag; minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    if (!isFinite(minY)) { minY = -10; maxY = 0; }
    const step = nice(model.radius / 4), size = Math.ceil((model.radius * 2.4) / step) * step;
    return { view: { target: [0, (minY + maxY) / 2, 0] as [number, number, number], dist: Math.max(40, model.radius * 2.0) }, gridY: maxY + 0.2, size, step };
  }, [model, exag]);
  const dark = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
  const g1 = dark ? "#6b625b" : "#a8a29e", g2 = dark ? "#3a3430" : "#e6e0d9";
  void tk;
  return (
    <Canvas frameloop="demand" dpr={[1, low ? 1 : 1.75]} gl={{ antialias: !low, alpha: true, powerPreference: "low-power" }}
      camera={{ fov: 45, near: 0.5, far: 50000, position: [100, 100, 100] }} onPointerMissed={() => onPick(null)}
      aria-label="3D drill-hole view. Drag to rotate, right-drag or two fingers to pan, scroll or pinch to zoom.">
      <ambientLight intensity={1.1} />
      <hemisphereLight args={["#ffffff", "#8a7b6b", 0.7]} />
      <directionalLight position={[model.radius, model.radius * 2, model.radius]} intensity={1.6} />
      <gridHelper args={[size, Math.round(size / step), g1, g2]} position={[0, gridY, 0]} />
      <Label text="N" position={[0, gridY, -size / 2 - step * 0.35]} width={Math.max(step * 1.6, 10)} />
      <Label text="E" position={[size / 2 + step * 0.35, gridY, 0]} width={Math.max(step * 1.6, 10)} />
      {holes.map((h: any) => <Hole key={h.id} model={model} h={h} mode={mode} exag={exag} r={r} selected={selected === h.id} labels={labels} onPick={onPick} />)}
      <Controls view={view} resetKey={resetKey} />
    </Canvas>
  );
}
