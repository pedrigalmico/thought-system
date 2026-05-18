"use client";

import { useCallback } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { useStore } from "@/store/useStore";

export function ZoomCtrl() {
  const zoom = useStore((s) => s.zoom);
  const zoomIn = useStore((s) => s.zoomIn);
  const zoomOut = useStore((s) => s.zoomOut);
  const zoomToFit = useStore((s) => s.zoomToFit);

  const handleFit = useCallback(() => {
    const wrap = document.querySelector(".canvas-wrap");
    if (!wrap) return;
    const { width, height } = wrap.getBoundingClientRect();
    if (width > 0 && height > 0) zoomToFit(width, height);
  }, [zoomToFit]);

  return (
    <div className="zoom-ctrl">
      <button onClick={zoomOut} aria-label="Zoom out"><Minus size={14} /></button>
      <div className="zoom-level">{Math.round(zoom * 100)}%</div>
      <button onClick={zoomIn} aria-label="Zoom in"><Plus size={14} /></button>
      <button onClick={handleFit} aria-label="Fit to content"><Maximize2 size={13} /></button>
    </div>
  );
}
