"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "./cards/Card";
import { ContextMenu, type ContextAction } from "./ContextMenu";
import { ZoomCtrl } from "./ZoomCtrl";
import { MiniMap } from "./MiniMap";
import { useStore } from "@/store/useStore";
import type { CanvasItem, Cluster, ImageItem, LinkItem, NoteItem } from "@/lib/types";
import { saveItem, fileToBase64, deleteItem, subscribeItems, subscribeClusters, saveCluster, deleteCluster, syncSnapshot } from "@/lib/db";
import { Toolbar } from "./Toolbar";

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

const GRID = 24;
const snap = (v: number) => Math.round(v / GRID) * GRID;
const MAX_IMAGES = 15;

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
  const tool = useStore((s) => s.tool);
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
  const addCluster = useStore((s) => s.addCluster);
  const updateCluster = useStore((s) => s.updateCluster);
  const pushUndo = useStore((s) => s.pushUndo);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const setClusters = useStore((s) => s.setClusters);
  const selectedIds = useStore((s) => s.selectedIds);
  const setSelectedIds = useStore((s) => s.setSelectedIds);
  const toggleSelectedId = useStore((s) => s.toggleSelectedId);
  const clearMultiSelection = useStore((s) => s.clearMultiSelection);

  const setItems = useStore((s) => s.setItems);
  const zoomToFit = useStore((s) => s.zoomToFit);
  const fitPending = useStore((s) => s.fitPending);

  useEffect(() => {
    return subscribeItems(topicId, setItems);
  }, [topicId, setItems]);

  useEffect(() => {
    return subscribeClusters(topicId, setClusters);
  }, [topicId, setClusters]);

  useEffect(() => {
    if (!fitPending) return;
    if (items.length === 0 && clusters.length === 0) return;
    const raf = requestAnimationFrame(() => {
      const el = wrapRef.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) zoomToFit(width, height);
    });
    return () => cancelAnimationFrame(raf);
  }, [items, clusters, fitPending, zoomToFit]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [panning, setPanning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ id: string; ox: number; oy: number; sx: number; sy: number; others: { id: string; ox: number; oy: number }[] } | null>(null);
  const panStartRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  // Lasso selection
  const [lasso, setLasso] = useState<{ sx: number; sy: number; ex: number; ey: number } | null>(null);
  const lassoRef = useRef(false);

  // Items contained in a cluster being dragged
  const clusterItemsRef = useRef<{ id: string; ox: number; oy: number }[]>([]);

  // Space key held = pan mode
  const spaceHeld = useRef(false);

  // Group label input
  const [groupPrompt, setGroupPrompt] = useState(false);
  const [groupLabel, setGroupLabel] = useState("");
  const groupInputRef = useRef<HTMLInputElement>(null);

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

  // ── Space key for pan mode ──────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === " " && !e.repeat) {
        const el = document.activeElement;
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)) return;
        e.preventDefault();
        spaceHeld.current = true;
        wrapRef.current?.classList.add("space-pan");
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") {
        spaceHeld.current = false;
        wrapRef.current?.classList.remove("space-pan");
      }
    };
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);
    return () => { document.removeEventListener("keydown", down); document.removeEventListener("keyup", up); };
  }, []);

  // ── Pointer events ───────────────────────────────────────────────────────────
  const onWrapPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".card")) return;
    if ((e.target as HTMLElement).closest(".cluster-frame")) return;
    if ((e.target as HTMLElement).closest(".ctx-menu")) return;
    if ((e.target as HTMLElement).closest(".group-label-overlay")) return;
    if ((e.target as HTMLElement).closest(".toolbar")) return;
    if ((e.target as HTMLElement).closest(".zoom-ctrl")) return;
    if ((e.target as HTMLElement).closest(".minimap")) return;

    setCtxMenu(null);

    // Space held or middle mouse → pan
    if (spaceHeld.current || e.button === 1) {
      setPanning(true);
      panStartRef.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Default: drag on empty canvas → selection rectangle
    selectItem(null);
    if (!e.shiftKey) clearMultiSelection();
    lassoRef.current = true;
    setLasso({ sx: e.clientX, sy: e.clientY, ex: e.clientX, ey: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onWrapPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) {
      const d = dragRef.current;
      const dx = (e.clientX - d.sx) / zoom;
      const dy = (e.clientY - d.sy) / zoom;
      const nx = snap(d.ox + dx);
      const ny = snap(d.oy + dy);
      moveItem(d.id, nx, ny);
      for (const o of d.others) {
        moveItem(o.id, nx + o.ox, ny + o.oy);
      }
      return;
    }
    if (lassoRef.current && lasso) {
      setLasso((l) => l ? { ...l, ex: e.clientX, ey: e.clientY } : l);
      return;
    }
    if (panning && panStartRef.current) {
      const p = panStartRef.current;
      setPan({ x: p.ox + (e.clientX - p.sx), y: p.oy + (e.clientY - p.sy) });
    }
  };

  const onWrapPointerUp = (e: React.PointerEvent) => {
    // Finalize lasso: select items inside rect
    if (lassoRef.current && lasso) {
      lassoRef.current = false;
      const wrap = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
      const lx1 = (Math.min(lasso.sx, lasso.ex) - wrap.left - pan.x) / zoom;
      const ly1 = (Math.min(lasso.sy, lasso.ey) - wrap.top - pan.y) / zoom;
      const lx2 = (Math.max(lasso.sx, lasso.ex) - wrap.left - pan.x) / zoom;
      const ly2 = (Math.max(lasso.sy, lasso.ey) - wrap.top - pan.y) / zoom;
      const hit = items
        .filter((it) => it.kind !== "draft" && it.x < lx2 && it.x + it.w > lx1 && it.y < ly2 && it.y + it.h > ly1)
        .map((it) => it.id);
      if (hit.length > 0) {
        setSelectedIds(e.shiftKey ? [...new Set([...selectedIds, ...hit])] : hit);
      }
      setLasso(null);
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
      return;
    }

    setPanning(false);
    panStartRef.current = null;
    if (dragRef.current) {
      const d = dragRef.current;
      const currentItems = useStore.getState().items;
      const movedIds = [d.id, ...d.others.map((o) => o.id)];
      for (const mid of movedIds) {
        const it = currentItems.find((i) => i.id === mid);
        if (it) saveItem(topicId, it).catch(() => {});
      }
    }
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom or ⌘+scroll → zoom
        const rect = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.08 : 0.93;
        const newZoom = Math.min(2.5, Math.max(0.2, zoom * factor));
        const scale = newZoom / zoom;
        setPan({ x: mx - (mx - pan.x) * scale, y: my - (my - pan.y) * scale });
        setZoom(newZoom);
      } else {
        // Bare scroll / trackpad → pan
        setPan({ x: pan.x - e.deltaX, y: pan.y - e.deltaY });
      }
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
      const active = document.activeElement;
      const inInput =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable);

      // ⌘Z / ⌘⇧Z — undo / redo
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        if (inInput) return;
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        const s = useStore.getState();
        syncSnapshot(topicId, s.items, s.clusters).catch(() => {});
        return;
      }

      // ⌘G — group selected items
      if ((e.metaKey || e.ctrlKey) && e.key === "g") {
        if (inInput) return;
        if (selectedIds.length < 2) return;
        e.preventDefault();
        setGroupLabel("");
        setGroupPrompt(true);
        setTimeout(() => groupInputRef.current?.focus(), 50);
        return;
      }

      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (inInput) return;

      const idsToDelete = selectedIds.length >= 2
        ? selectedIds
        : selectedId
          ? [selectedId]
          : [];
      if (idsToDelete.length === 0) return;

      e.preventDefault();
      pushUndo();
      for (const id of idsToDelete) {
        removeItem(id);
        deleteItem(topicId, id).catch(() => {});
      }
      selectItem(null);
      clearMultiSelection();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedId, selectedIds, removeItem, selectItem, clearMultiSelection, topicId, undo, redo, pushUndo]);

  const startDrag = (id: string, x: number, y: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    pushUndo();
    const isMulti = selectedIds.includes(id) && selectedIds.length > 1;
    const others = isMulti
      ? items.filter((it) => selectedIds.includes(it.id) && it.id !== id).map((it) => ({ id: it.id, ox: it.x - x, oy: it.y - y }))
      : [];
    dragRef.current = { id, ox: x, oy: y, sx: e.clientX, sy: e.clientY, others };
    wrapRef.current?.setPointerCapture(e.pointerId);
  };

  const onCardSelect = useCallback(
    (id: string, e: React.PointerEvent) => {
      if (e.shiftKey) {
        toggleSelectedId(id);
      } else {
        clearMultiSelection();
        selectItem(id);
      }
    },
    [selectItem, toggleSelectedId, clearMultiSelection]
  );

  const commitGroup = useCallback(() => {
    const label = groupLabel.trim() || "Group";
    const selected = items.filter((it) => selectedIds.includes(it.id));
    if (selected.length < 2) { setGroupPrompt(false); return; }
    pushUndo();
    const PAD = 40;
    const minX = Math.min(...selected.map((it) => it.x)) - PAD;
    const minY = Math.min(...selected.map((it) => it.y)) - PAD - 28;
    const maxX = Math.max(...selected.map((it) => it.x + it.w)) + PAD;
    const maxY = Math.max(...selected.map((it) => it.y + it.h)) + PAD;
    const cluster: Cluster = {
      id: uid(),
      label,
      count: selected.length,
      x: minX, y: minY,
      w: maxX - minX, h: maxY - minY,
    };
    addCluster(cluster);
    saveCluster(topicId, cluster).catch(() => {});
    clearMultiSelection();
    setGroupPrompt(false);
    setGroupLabel("");
  }, [groupLabel, items, selectedIds, addCluster, topicId, clearMultiSelection]);

  // ── Drop handling ────────────────────────────────────────────────────────────
  const [dropActive, setDropActive] = useState(false);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(true);
  };
  const onDragLeave = () => setDropActive(false);

  const placeItem = useCallback(
    async (item: CanvasItem) => {
      pushUndo();
      addItem(item);
      try { await saveItem(topicId, item); } catch {}
    },
    [addItem, topicId, pushUndo]
  );

  const handleImageFileSelect = useCallback(
    async (file: File) => {
      const imageCount = useStore.getState().items.filter((it) => it.kind === "image").length;
      if (imageCount >= MAX_IMAGES) {
        alert(`You can add up to ${MAX_IMAGES} images per topic. Remove one before adding another.`);
        pendingImagePos.current = null;
        return;
      }
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
      const raw = screenToCanvas(e.clientX, e.clientY);
      const x = snap(raw.x), y = snap(raw.y);

      // Image files
      for (const file of Array.from(e.dataTransfer.files)) {
        if (file.type.startsWith("image/")) {
          const imageCount = useStore.getState().items.filter((it) => it.kind === "image").length;
          if (imageCount >= MAX_IMAGES) {
            alert(`You can add up to ${MAX_IMAGES} images per topic. Remove one before adding another.`);
            return;
          }
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
      const raw = screenToCanvas(e.clientX, e.clientY);
      setCtxMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: snap(raw.x), canvasY: snap(raw.y) });
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
      }
    },
    [ctxMenu, placeItem, selectItem, handleTextDrop]
  );

  // ── Paste from clipboard ─────────────────────────────────────────────────────
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable) return;
      const raw = screenToCanvas(
        window.innerWidth / 2,
        window.innerHeight / 2
      );
      const x = snap(raw.x), y = snap(raw.y);
      for (const item of Array.from(e.clipboardData?.items ?? [])) {
        if (item.type.startsWith("image/")) {
          const imageCount = useStore.getState().items.filter((it) => it.kind === "image").length;
          if (imageCount >= MAX_IMAGES) {
            alert(`You can add up to ${MAX_IMAGES} images per topic. Remove one before adding another.`);
            return;
          }
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

  // Lasso rect in canvas-wrap–relative screen coords
  const lassoStyle = lasso
    ? {
        left: Math.min(lasso.sx, lasso.ex) - (wrapRef.current?.getBoundingClientRect().left ?? 0),
        top: Math.min(lasso.sy, lasso.ey) - (wrapRef.current?.getBoundingClientRect().top ?? 0),
        width: Math.abs(lasso.ex - lasso.sx),
        height: Math.abs(lasso.ey - lasso.sy),
      }
    : null;

  return (
    <div
      ref={wrapRef}
      className={`canvas-wrap${panning ? " panning" : ""}${tool === "lasso" ? " tool-lasso" : ""}`}
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

      {/* Lasso selection rect */}
      {lassoStyle && <div className="lasso-rect" style={lassoStyle} />}

      {/* ⌘G group label input */}
      {groupPrompt && (
        <div className="group-label-overlay">
          <div className="group-label-box">
            <span className="group-label-hint">Name this group</span>
            <input
              ref={groupInputRef}
              className="group-label-input"
              placeholder="e.g. Research, Ideas…"
              value={groupLabel}
              onChange={(e) => setGroupLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitGroup();
                if (e.key === "Escape") { setGroupPrompt(false); setGroupLabel(""); }
              }}
            />
            <div className="group-label-actions">
              <button className="btn ghost" onClick={() => { setGroupPrompt(false); setGroupLabel(""); }}>Cancel</button>
              <button className="btn primary" onClick={commitGroup}>Group {selectedIds.length} items →</button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-select count badge */}
      {selectedIds.length >= 2 && !groupPrompt && (
        <div className="multi-select-badge">
          {selectedIds.length} selected · <kbd>⌘G</kbd> to group
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
            zoom={zoom}
            onRename={(label) => {
              renameCluster(c.id, label);
              saveCluster(topicId, { ...c, label }).catch(() => {});
            }}
            onDragStart={() => {
              // Find items inside the cluster bounds and store their offsets
              const contained = items.filter(
                (it) => it.x >= c.x && it.y >= c.y && it.x + it.w <= c.x + c.w && it.y + it.h <= c.y + c.h
              );
              clusterItemsRef.current = contained.map((it) => ({ id: it.id, ox: it.x - c.x, oy: it.y - c.y }));
            }}
            onDragMove={(x, y) => {
              updateCluster(c.id, { x, y });
              for (const ci of clusterItemsRef.current) {
                moveItem(ci.id, x + ci.ox, y + ci.oy);
              }
            }}
            onDragEnd={() => {
              const latest = useStore.getState().clusters.find((cl) => cl.id === c.id);
              if (latest) saveCluster(topicId, latest).catch(() => {});
              const currentItems = useStore.getState().items;
              for (const ci of clusterItemsRef.current) {
                const it = currentItems.find((i) => i.id === ci.id);
                if (it) saveItem(topicId, it).catch(() => {});
              }
              clusterItemsRef.current = [];
            }}
            onResize={(patch) => updateCluster(c.id, patch)}
            onResizeEnd={() => {
              const latest = useStore.getState().clusters.find((cl) => cl.id === c.id);
              if (latest) saveCluster(topicId, latest).catch(() => {});
            }}
            onDelete={() => {
              removeCluster(c.id);
              deleteCluster(topicId, c.id).catch(() => {});
            }}
          />
        ))}

        {items.filter((it) => it.kind !== "draft").map((it) => (
          <Card
            key={it.id}
            item={it}
            selected={selectedId === it.id}
            multiSelected={selectedIds.includes(it.id)}
            topicId={topicId}
            onSelect={(e) => onCardSelect(it.id, e)}
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

      <Toolbar />
      <MiniMap />
      <ZoomCtrl />
    </div>
  );
}

/* ── Cluster frame — movable, resizable, renamable ────────────────────────── */

type ResizeDir = "nw" | "ne" | "sw" | "se";

function ClusterFrame({
  cluster,
  zoom,
  onRename,
  onDragStart,
  onDragMove,
  onDragEnd,
  onResize,
  onResizeEnd,
  onDelete,
}: {
  cluster: Cluster;
  zoom: number;
  onRename: (label: string) => void;
  onDragStart: () => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: () => void;
  onResize: (patch: Partial<Cluster>) => void;
  onResizeEnd: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.select(), 0);
  }, [editing]);

  const commit = () => {
    const val = inputRef.current?.value.trim();
    if (val) onRename(val);
    setEditing(false);
  };

  // ── Drag to move (window-level listeners for reliability) ──
  const onMoveDown = (e: React.PointerEvent) => {
    if (editing) return;
    if ((e.target as HTMLElement).closest(".cluster-delete-btn")) return;
    if ((e.target as HTMLElement).closest(".cluster-resize")) return;
    if ((e.target as HTMLElement).closest(".cluster-label")) return;
    e.stopPropagation();

    const sx = e.clientX, sy = e.clientY;
    const ox = cluster.x, oy = cluster.y;
    let moved = false;

    onDragStart();

    const onMove = (ev: PointerEvent) => {
      moved = true;
      const dx = (ev.clientX - sx) / zoom;
      const dy = (ev.clientY - sy) / zoom;
      onDragMove(ox + dx, oy + dy);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (moved) onDragEnd();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ── Resize (window-level listeners) ──
  const onResizeDown = (dir: ResizeDir) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const sx = e.clientX, sy = e.clientY;
    const ox = cluster.x, oy = cluster.y, ow = cluster.w, oh = cluster.h;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / zoom;
      const dy = (ev.clientY - sy) / zoom;
      const patch: Partial<Cluster> = {};

      if (dir === "se") {
        patch.w = Math.max(120, ow + dx);
        patch.h = Math.max(80, oh + dy);
      } else if (dir === "sw") {
        const newW = Math.max(120, ow - dx);
        patch.x = ox + (ow - newW);
        patch.w = newW;
        patch.h = Math.max(80, oh + dy);
      } else if (dir === "ne") {
        patch.w = Math.max(120, ow + dx);
        const newH = Math.max(80, oh - dy);
        patch.y = oy + (oh - newH);
        patch.h = newH;
      } else if (dir === "nw") {
        const newW = Math.max(120, ow - dx);
        const newH = Math.max(80, oh - dy);
        patch.x = ox + (ow - newW);
        patch.y = oy + (oh - newH);
        patch.w = newW;
        patch.h = newH;
      }
      onResize(patch);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      onResizeEnd();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className={`cluster-frame ${hovered ? "cluster-hovered" : ""}`}
      style={{ left: cluster.x, top: cluster.y, width: cluster.w, height: cluster.h }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={onMoveDown}
    >
      {/* Label row */}
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
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="cluster-label"
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            onPointerDown={(e) => e.stopPropagation()}
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

      {/* Resize handles — always rendered, visible on hover via CSS */}
      <div className="cluster-resize nw" onPointerDown={onResizeDown("nw")} />
      <div className="cluster-resize ne" onPointerDown={onResizeDown("ne")} />
      <div className="cluster-resize sw" onPointerDown={onResizeDown("sw")} />
      <div className="cluster-resize se" onPointerDown={onResizeDown("se")} />
    </div>
  );
}
