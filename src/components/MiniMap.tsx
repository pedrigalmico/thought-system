"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";

const WORLD_W = 1700;
const WORLD_H = 900;

export function MiniMap() {
  const items = useStore((s) => s.items);
  const clusters = useStore((s) => s.clusters);
  const selectedId = useStore((s) => s.selectedId);
  const zoom = useStore((s) => s.zoom);
  const pan = useStore((s) => s.pan);

  const [winSize, setWinSize] = useState({ w: 1200, h: 800 });
  useEffect(() => {
    setWinSize({ w: window.innerWidth, h: window.innerHeight });
  }, []);

  const innerW = 168;
  const innerH = 96;
  const sx = innerW / WORLD_W;
  const sy = innerH / WORLD_H;

  const vpW = winSize.w / zoom;
  const vpH = winSize.h / zoom;
  const vp = {
    left: -pan.x * sx,
    top: -pan.y * sy,
    width: vpW * sx,
    height: vpH * sy,
  };

  return (
    <div className="minimap" aria-hidden>
      <div className="minimap-label">MAP · TOPIC</div>
      <div className="minimap-content">
        {clusters.map((c) => (
          <div
            key={c.id}
            className="minimap-cluster"
            style={{
              left: c.x * sx,
              top: c.y * sy,
              width: c.w * sx,
              height: c.h * sy,
            }}
          />
        ))}
        {items.map((it) => (
          <div
            key={it.id}
            className={`minimap-item ${it.kind === "image" ? "image" : ""} ${
              it.id === selectedId ? "coral" : ""
            }`}
            style={{
              left: it.x * sx,
              top: it.y * sy,
              width: Math.max(3, it.w * sx),
              height: Math.max(3, it.h * sy),
            }}
          />
        ))}
        <div
          className="minimap-vp"
          style={{
            left: vp.left,
            top: vp.top,
            width: Math.min(innerW, Math.max(8, vp.width)),
            height: Math.min(innerH, Math.max(8, vp.height)),
          }}
        />
      </div>
    </div>
  );
}
