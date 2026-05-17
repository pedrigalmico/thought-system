"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "./cards/Card";
import { ContextMenu, type ContextAction } from "./ContextMenu";
import { ZoomCtrl } from "./ZoomCtrl";
import { MiniMap } from "./MiniMap";
import { useStore } from "@/store/useStore";
import type { CanvasItem, Cluster, DraftItem, ImageItem, LinkItem, NoteItem } from "@/lib/types";
import { saveItem, fileToBase64, deleteItem, subscribeItems, subscribeClusters, saveCluster, deleteCluster } from "@/lib/db";

function isYouTubeUrl(url: string) {
  return /youtu\.be\/|youtube\.com\/(watch|shorts|embed)/.test(url);
}

function extractYouTubeId(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Compress to JPEG, max 1400px on longest side, iterating quality until
// the base64 string fits under 700 KB (safely within Firestore's 1 MB doc limit).
// Also returns the display dimensions for the canvas node.
function processImageSrc(src: string): Promise<{ src: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const MAX_DIM = 1400;
      const MAX_CANVAS_W = 480;
      const MAX_CANVAS_H = 400;
      const MAX_B64 = 700_000;

      const dimScale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
      const canvasW = Math.round(img.naturalWidth * dimScale);
      const canvasH = Math.round(img.naturalHeight * dimScale);

      const displayScale = Math.min(1, MAX_CANVAS_W / canvasW, MAX_CANVAS_H / canvasH);
      const displayW = Math.round(canvasW * displayScale);
      const displayH = Math.round(canvasH * displayScale);

      if (!src.startsWith("data:")) {
        resolve({ src, w: displayW, h: displayH });
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvasW, canvasH);

      let quality = 0.85;
      const tryNext = (): void => {
        const out = canvas.toDataURL("image/jpeg", quality);
        if (out.length <= MAX_B64) {
          resolve({ src: out, w: displayW, h: displayH });
        } else if (quality <= 0.15) {
          reject(new Error("too_large"));
        } else {
          quality = Math.round((quality - 0.1) * 100) / 100;
          tryNext();
        }
      };
      tryNext();
    };
    img.onerror = () => reject(new Error("load_failed"));
    img.src = src;
  });
}

interface Props {
  topicId: string;
}

export function Canvas({ topicId }: Props) {
  const items = useStore((s) => s.items);
  const clusters = useStore((s) => s.clusters);
  const zoom = useStore((s) => s.zoom);
  const pan = useStore((s) => s.pan);
  const setPan = useStore((s) => s.setPan);
  const setZoom = useStore((s) => s.setZoom);
  const selectedId = useStore((s) => s.selectedId);
  const selectItem = useStore((s) => s.selectItem);
  const moveItem = useStore((s) => s.moveItem);
  const addItem = useStore((s) => s.addItem);
  const removeItem = useStore((s) => s.removeItem);
  const renameCluster = useStore((s) => s.renameCluster);
  const removeCluster = useStore((s) => s.removeCluster);
  const setClusters = useStore((s) => s.setClusters);

  const setItems = useStore((s) => s.setItems);

  useEffect(() => {
    return subscribeItems(topicId, setItems);
  }, [topicId, setItems]);

  useEffect(() => {
    return subscribeClusters(topicId, setClusters);
  }, [topicId, setClusters]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [panning, setPanning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ id: string; ox: number; oy: number; sx: number; sy: number } | null>(null);
  const panStartRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const [ctxMenu, setCtxMenu] = useState<{ screenX: number; screenY: number; canvasX: number; canvasY: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImagePos = useRef<{ x: number; y: number } | null>(null);

  // Convert screen coords → canvas coords
  const screenToCanvas = useCallback(
    (sx: number, sy: number) => {
      const rect = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
      return {
        x: (sx - rect.left - pan.x) / zoom,
        y: (sy - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // ── Pointer events ───────────────────────────────────────────────────────────
  const onWrapPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".card")) return;
    if ((e.target as HTMLElement).closest(".ctx-menu")) return;

    setCtxMenu(null);
    selectItem(null);
    setPanning(true);
    panStartRef.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onWrapPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) {
      const d = dragRef.current;
      const dx = (e.clientX - d.sx) / zoom;
      const dy = (e.clientY - d.sy) / zoom;
      moveItem(d.id, d.ox + dx, d.oy + dy);
      return;
    }
    if (panning && panStartRef.current) {
      const p = panStartRef.current;
      setPan({ x: p.ox + (e.clientX - p.sx), y: p.oy + (e.clientY - p.sy) });
    }
  };

  const onWrapPointerUp = (e: React.PointerEvent) => {
    setPanning(false);
    panStartRef.current = null;
    if (dragRef.current) {
      const d = dragRef.current;
      const item = items.find((i) => i.id === d.id);
      if (item) saveItem(topicId, item).catch(() => {});
    }
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const onWheel = useCallback(
    (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.08 : 0.93;
      const newZoom = Math.min(2.5, Math.max(0.2, zoom * factor));
      const scale = newZoom / zoom;
      setPan({ x: mx - (mx - pan.x) * scale, y: my - (my - pan.y) * scale });
      setZoom(newZoom);
    },
    [zoom, pan, setPan, setZoom]
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) return;
      if (!selectedId) return;
      e.preventDefault();
      removeItem(selectedId);
      deleteItem(topicId, selectedId).catch(() => {});
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedId, removeItem, topicId]);

  const startDrag = (id: string, x: number, y: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = { id, ox: x, oy: y, sx: e.clientX, sy: e.clientY };
    wrapRef.current?.setPointerCapture(e.pointerId);
  };

  // ── Drop handling ────────────────────────────────────────────────────────────
  const [dropActive, setDropActive] = useState(false);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(true);
  };
  const onDragLeave = () => setDropActive(false);

  const placeItem = useCallback(
    async (item: CanvasItem) => {
      addItem(item);
      try { await saveItem(topicId, item); } catch {}
    },
    [addItem, topicId]
  );

  const handleImageFileSelect = useCallback(
    async (file: File) => {
      const pos = pendingImagePos.current ?? { x: 200, y: 200 };
      let raw: string;
      try { raw = await fileToBase64(file); } catch { raw = URL.createObjectURL(file); }
      let processed: { src: string; w: number; h: number };
      try {
        processed = await processImageSrc(raw);
      } catch {
        alert(`"${file.name}" is too large to store even after compression. Please use an image under 5 MB.`);
        pendingImagePos.current = null;
        return;
      }
      const item: ImageItem = { id: uid(), kind: "image", x: pos.x, y: pos.y, ...processed, alt: file.name };
      await placeItem(item);
      pendingImagePos.current = null;
    },
    [topicId, placeItem]
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDropActive(false);
      const { x, y } = screenToCanvas(e.clientX, e.clientY);

      // Image files
      for (const file of Array.from(e.dataTransfer.files)) {
        if (file.type.startsWith("image/")) {
          let raw: string;
          try { raw = await fileToBase64(file); } catch { raw = URL.createObjectURL(file); }
          let processed: { src: string; w: number; h: number };
          try {
            processed = await processImageSrc(raw);
          } catch {
            alert(`"${file.name}" is too large to store even after compression. Please use an image under 5 MB.`);
            return;
          }
          const item: ImageItem = { id: uid(), kind: "image", x, y, ...processed, alt: file.name };
          await placeItem(item);
          return;
        }
      }

      // URLs / text
      const text = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text/uri-list");
      if (text) {
        await handleTextDrop(text, x, y);
      }
    },
    [screenToCanvas, placeItem, topicId]
  );

  const handleTextDrop = useCallback(
    async (text: string, x: number, y: number) => {
      if (isYouTubeUrl(text)) {
        const ytId = extractYouTubeId(text);
        const item: CanvasItem = {
          id: uid(),
          kind: "video",
          x, y, w: 340, h: 220,
          title: "YouTube video",
          duration: "—",
          thumb: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined,
        };
        await placeItem(item);
        return;
      }
      try {
        const url = new URL(text);
        const item: LinkItem = {
          id: uid(),
          kind: "link",
          x, y, w: 320, h: 140,
          host: url.hostname.replace("www.", ""),
          title: text,
          snippet: "Fetching preview…",
        };
        await placeItem(item);
        return;
      } catch {}

      // Plain text → note
      const item: NoteItem = { id: uid(), kind: "note", x, y, w: 300, h: 90, body: text };
      await placeItem(item);
    },
    [placeItem]
  );

  // ── Right-click context menu ──────────────────────────────────────────────────
  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest(".card")) return;
      e.preventDefault();
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      setCtxMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: x, canvasY: y });
    },
    [screenToCanvas]
  );

  const onCtxAction = useCallback(
    (action: ContextAction) => {
      if (!ctxMenu) return;
      const { canvasX: x, canvasY: y } = ctxMenu;
      setCtxMenu(null);

      if (action === "note") {
        const item: NoteItem = { id: uid(), kind: "note", x, y, w: 300, h: 90, body: "" };
        placeItem(item);
        selectItem(item.id);
      } else if (action === "image") {
        pendingImagePos.current = { x, y };
        fileInputRef.current?.click();
      } else if (action === "link") {
        const url = window.prompt("Paste a URL:");
        if (url?.trim()) handleTextDrop(url.trim(), x, y);
      } else if (action === "video") {
        const url = window.prompt("Paste a YouTube URL:");
        if (url?.trim()) handleTextDrop(url.trim(), x, y);
      } else if (action === "voice") {
        const item: CanvasItem = {
          id: uid(), kind: "voice", x, y, w: 280, h: 100,
          duration: "0:00", transcript: "",
        };
        placeItem(item);
        selectItem(item.id);
      } else if (action === "draft") {
        const item: DraftItem = {
          id: uid(), kind: "draft", x, y, w: 480, h: 300,
          title: "", body: [], wordCount: 0, slopFlags: 0,
        };
        placeItem(item);
        selectItem(item.id);
      }
    },
    [ctxMenu, placeItem, selectItem, handleTextDrop]
  );

  // ── Paste from clipboard ─────────────────────────────────────────────────────
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable) return;
      const { x, y } = screenToCanvas(
        window.innerWidth / 2,
        window.innerHeight / 2
      );
      for (const item of Array.from(e.clipboardData?.items ?? [])) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          let raw: string;
          try { raw = await fileToBase64(file); } catch { raw = URL.createObjectURL(file); }
          let processed: { src: string; w: number; h: number };
          try {
            processed = await processImageSrc(raw);
          } catch {
            alert("Pasted image is too large to store even after compression. Please use an image under 5 MB.");
            return;
          }
          const card: ImageItem = { id: uid(), kind: "image", x, y, ...processed, alt: "pasted image" };
          await placeItem(card);
          return;
        }
      }
      const text = e.clipboardData?.getData("text/plain");
      if (text) await handleTextDrop(text, x, y);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [screenToCanvas, placeItem, handleTextDrop, topicId]);

  return (
    <div
      ref={wrapRef}
      className={`canvas-wrap ${panning ? "panning" : ""}`}
      onPointerDown={onWrapPointerDown}
      onPointerMove={onWrapPointerMove}
      onPointerUp={onWrapPointerUp}
      onPointerCancel={onWrapPointerUp}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="canvas-bg" />

      {dropActive && (
        <div className="drop-overlay">
          <span className="drop-overlay-text">Drop image, URL, or text</span>
        </div>
      )}

      <div
        className="canvas"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {clusters.map((c) => (
          <ClusterFrame
            key={c.id}
            cluster={c}
            onRename={(label) => {
              const updated = { ...c, label };
              renameCluster(c.id, label);
              saveCluster(topicId, updated).catch(() => {});
            }}
            onDelete={() => {
              removeCluster(c.id);
              deleteCluster(topicId, c.id).catch(() => {});
            }}
          />
        ))}

        {items.map((it) => (
          <Card
            key={it.id}
            item={it}
            selected={selectedId === it.id}
            topicId={topicId}
            onSelect={() => selectItem(it.id)}
            onDragStart={startDrag(it.id, it.x, it.y)}
          />
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageFileSelect(file);
          e.target.value = "";
        }}
      />

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.screenX}
          y={ctxMenu.screenY}
          onSelect={onCtxAction}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <MiniMap />
      <ZoomCtrl />
    </div>
  );
}

/* ── Cluster frame with inline rename + delete ─────────────────────────────── */

function ClusterFrame({
  cluster,
  onRename,
  onDelete,
}: {
  cluster: Cluster;
  onRename: (label: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const val = inputRef.current?.value.trim();
    if (val) onRename(val);
    setEditing(false);
  };

  return (
    <div
      className={`cluster-frame ${hovered ? "cluster-hovered" : ""}`}
      style={{ left: cluster.x, top: cluster.y, width: cluster.w, height: cluster.h }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="cluster-label-row">
        {editing ? (
          <input
            ref={inputRef}
            className="cluster-label-input"
            defaultValue={cluster.label}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="cluster-label"
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
          >
            {cluster.label}
            <span className="count">{cluster.count}</span>
          </span>
        )}
        {hovered && !editing && (
          <button
            className="cluster-delete-btn"
            title="Delete group"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
