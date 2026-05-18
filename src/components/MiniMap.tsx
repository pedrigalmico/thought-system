"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/store/useStore";

const MIN_WORLD_W = 1700;
const MIN_WORLD_H = 900;
const PAD = 100;

export function MiniMap() {
  const items = useStore((s) => s.items);
  const clusters = useStore((s) => s.clusters);
  const selectedId = useStore((s) => s.selectedId);
  const zoom = useStore((s) => s.zoom);
  const pan = useStore((s) => s.pan);
  const setPan = useStore((s) => s.setPan);

  const contentRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const [winSize, setWinSize] = useState({ w: 1200, h: 800 });
  useEffect(() => {
    const update = () => setWinSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const world = useMemo(() => {
    const vpX = -pan.x / zoom;
    const vpY = -pan.y / zoom;
    const vpW = winSize.w / zoom;
    const vpH = winSize.h / zoom;

    const all = [
      ...items.map((it) => ({ x: it.x, y: it.y, w: it.w, h: it.h })),
      ...clusters.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h })),
      { x: vpX, y: vpY, w: vpW, h: vpH },
    ];
    const minX = Math.min(...all.map((a) => a.x)) - PAD;
    const minY = Math.min(...all.map((a) => a.y)) - PAD;
    const maxX = Math.max(...all.map((a) => a.x + a.w)) + PAD;
    const maxY = Math.max(...all.map((a) => a.y + a.h)) + PAD;
    return {
      ox: minX,
      oy: minY,
      w: Math.max(MIN_WORLD_W, maxX - minX),
      h: Math.max(MIN_WORLD_H, maxY - minY),
    };
  }, [items, clusters, pan, zoom, winSize]);

  const innerW = 168;
  const innerH = 96;
  const sx = innerW / world.w;
  const sy = innerH / world.h;

  const vpW = winSize.w / zoom;
  const vpH = winSize.h / zoom;
  const vpLeft = (-pan.x / zoom - world.ox) * sx;
  const vpTop = (-pan.y / zoom - world.oy) * sy;

  const panToMiniMapPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = contentRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const canvasX = mx / sx + world.ox;
      const canvasY = my / sy + world.oy;
      setPan({
        x: -(canvasX - winSize.w / (2 * zoom)) * zoom,
        y: -(canvasY - winSize.h / (2 * zoom)) * zoom,
      });
    },
    [sx, sy, world, zoom, winSize, setPan]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      dragging.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      panToMiniMapPoint(e.clientX, e.clientY);
    },
    [panToMiniMapPoint]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      panToMiniMapPoint(e.clientX, e.clientY);
    },
    [panToMiniMapPoint]
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div className="minimap">
      <div className="minimap-label">MAP · TOPIC</div>
      <div
        ref={contentRef}
        className="minimap-content"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {clusters.map((c) => (
          <div
            key={c.id}
            className="minimap-cluster"
            style={{
              left: (c.x - world.ox) * sx,
              top: (c.y - world.oy) * sy,
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
              left: (it.x - world.ox) * sx,
              top: (it.y - world.oy) * sy,
              width: Math.max(3, it.w * sx),
              height: Math.max(3, it.h * sy),
            }}
          />
        ))}
        <div
          className="minimap-vp"
          style={{
            left: vpLeft,
            top: vpTop,
            width: Math.min(innerW, Math.max(8, vpW * sx)),
            height: Math.min(innerH, Math.max(8, vpH * sy)),
          }}
        />
      </div>
    </div>
  );
}
