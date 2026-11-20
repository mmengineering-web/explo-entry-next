"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import { core, type Info } from "@/lib/boot";
import { Card, CardTitle } from "./ui/card";
import { useToast } from "./toast";
import { useConfirm } from "./confirm";

// The map itself is the existing plain-JS module (Leaflet, layer panel, PDF export); React only gives it a place to live.
export function MapView({ info }: { info: Info }) {
  const mapEl = useRef<HTMLDivElement>(null), noteEl = useRef<HTMLDivElement>(null), box = useRef<HTMLDivElement>(null), det = useRef<HTMLDetailsElement>(null);
  const toast = useToast(), ask = useConfirm();
  const draw = async () => {
    if (!mapEl.current || !noteEl.current) return;
    await core(); const m: any = await import("@/lib/core/map.js");
    await m.showMap(mapEl.current, noteEl.current, { info, canAdmin: !!info.can_admin });
  };
  useEffect(() => { draw(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [info.site]);
  async function layers() {
    if (!box.current) return; const { viewMapLayers } = await import("@/lib/core/maplayers.js");
    await viewMapLayers(box.current, toast, ask, info, draw);
  }
  return (
    <div className="mapx enter flex flex-col gap-4" id="peta">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div id="map" ref={mapEl} />
        <div ref={noteEl} />
      </div>
      <Card><details id="mlm" ref={det} onToggle={() => { if (det.current?.open && box.current && !box.current.innerHTML) layers(); }}>
        <summary className="cursor-pointer select-none"><CardTitle className="inline">Layer peta</CardTitle> <span className="text-sm text-muted-foreground">(upload shapefile / GeoJSON, tersimpan di perangkat ini)</span></summary>
        <div className="mt-3" id="mlm-box" ref={box} />
      </details></Card>
    </div>
  );
}
