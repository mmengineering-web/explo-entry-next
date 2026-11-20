"use client";
import { useEffect, useRef } from "react";
import { core, canForm, type Info } from "@/lib/boot";
import { useToast } from "./toast";

// The RoA reader (pdf.js, parser, preview, save) is the existing plain-JS module; React only gives it a place to live.
export function RoaView({ info }: { info: Info }) {
  const el = useRef<HTMLDivElement>(null); const toast = useToast();
  useEffect(() => {
    (async () => { await core(); const { viewRoa } = await import("@/lib/core/roa/view.js"); if (el.current) await viewRoa(el.current, { toast, canSave: canForm(info, "sample") }); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.site]);
  return <div ref={el} className="mapx roax enter flex flex-col gap-4" id="roa" />;
}
