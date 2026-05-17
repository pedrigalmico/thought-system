"use client";

import { Minus, Plus, Maximize2 } from "lucide-react";
import { useStore } from "@/store/useStore";

export function ZoomCtrl() {
  const zoom = useStore((s) => s.zoom);
  const zoomIn = useStore((s) => s.zoomIn);
  const zoomOut = useStore((s) => s.zoomOut);
  const reset = useStore((s) => s.zoomReset);
  return (
    <div className="zoom-ctrl">
      <button onClick={zoomOut} aria-label="Zoom out"><Minus size={14} /></button>
      <div className="zoom-level">{Math.round(zoom * 100)}%</div>
      <button onClick={zoomIn} aria-label="Zoom in"><Plus size={14} /></button>
      <button onClick={reset} aria-label="Reset"><Maximize2 size={13} /></button>
    </div>
  );
}
