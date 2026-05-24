"use client";

import { create } from "zustand";
import type { CanvasItem, Cluster, Counter, DraftItem, DraftVersion, Gate, RealityRow, ScrubRow, Tool, VersionPlatform } from "@/lib/types";


type RingTab = "advocate" | "reality" | "tone";

interface DebateLoading {
  advocate: boolean;
  reality: boolean;
  tone: boolean;
  synthesis: boolean;
}

type Snapshot = { items: CanvasItem[]; clusters: Cluster[] };
const MAX_UNDO = 50;
const undoStack: Snapshot[] = [];
const redoStack: Snapshot[] = [];

interface State {
  topicId: string | null;
  topicTitle: string;
  gate: Gate;
  tool: Tool;
  zoom: number;
  pan: { x: number; y: number };
  fitPending: boolean;

  items: CanvasItem[];
  clusters: Cluster[];
  selectedId: string | null;
  selectedIds: string[];

  panelOpen: boolean;
  sourcesOpen: boolean;
  ringTab: RingTab;
  counters: Counter[];
  recording: boolean;

  // Debate state
  realityRows: RealityRow[];
  scrubRows: ScrubRow[];
  debateLoading: DebateLoading;
  synthesizedDraft: DraftItem | null;
  showDiff: boolean;
  debateGenerated: boolean;
  activeCounterId: string | null;
  intent: string;
  analyzedDraftHash: string;
  staleRealityCheck: boolean;
  staleToneScrubber: boolean;

  // Version state
  activeVersion: VersionPlatform | null;
  condensing: boolean;

  setTopic: (id: string, title: string) => void;
  setGate: (g: Gate) => void;
  setTool: (t: Tool) => void;
  setZoom: (z: number) => void;
  setPan: (p: { x: number; y: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  zoomToFit: (viewW: number, viewH: number) => void;

  setItems: (items: CanvasItem[]) => void;
  setClusters: (clusters: Cluster[]) => void;
  selectItem: (id: string | null) => void;
  addItem: (item: CanvasItem) => void;
  updateItem: (id: string, patch: Partial<CanvasItem>) => void;
  removeItem: (id: string) => void;
  moveItem: (id: string, x: number, y: number) => void;

  setSelectedIds: (ids: string[]) => void;
  toggleSelectedId: (id: string) => void;
  clearMultiSelection: () => void;

  renameCluster: (id: string, label: string) => void;
  removeCluster: (id: string) => void;
  addCluster: (cluster: Cluster) => void;
  updateCluster: (id: string, patch: Partial<Cluster>) => void;

  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
  toggleSources: () => void;
  setSourcesOpen: (open: boolean) => void;
  setRingTab: (t: RingTab) => void;
  setCounterStatus: (id: string, status: Counter["status"]) => void;

  toggleRecording: () => void;

  pushUndo: () => void;
  undo: () => void;
  redo: () => void;

  // Debate actions
  setCounters: (counters: Counter[]) => void;
  setRealityRows: (rows: RealityRow[]) => void;
  setActiveCounterId: (id: string | null) => void;
  setScrubRows: (rows: ScrubRow[]) => void;
  setScrubAccepted: (index: number, accepted: boolean) => void;
  setDebateLoading: (key: keyof DebateLoading, loading: boolean) => void;
  updateCounter: (id: string, patch: Partial<Counter>) => void;
  setSynthesizedDraft: (draft: DraftItem | null) => void;
  setShowDiff: (show: boolean) => void;
  setDebateGenerated: (v: boolean) => void;
  commitSynthesis: () => void;
  setIntent: (intent: string) => void;
  resetDebate: () => void;
  setAnalyzedDraftHash: (hash: string) => void;
  markRealityStale: () => void;
  markToneStale: () => void;
  clearRealityStale: () => void;
  clearToneStale: () => void;

  // Version actions
  setActiveVersion: (platform: VersionPlatform | null) => void;
  setCondensing: (v: boolean) => void;
  updateVersion: (draftId: string, platform: VersionPlatform, patch: Partial<DraftVersion>) => void;
  removeVersion: (draftId: string, platform: VersionPlatform) => void;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const useStore = create<State>((set) => ({
  topicId: null,
  topicTitle: "",
  gate: "seed",
  tool: "select",
  zoom: 0.75,
  pan: { x: 60, y: 60 },
  fitPending: false,

  items: [],
  clusters: [],
  selectedId: null,
  selectedIds: [],

  panelOpen: false,
  sourcesOpen: false,
  ringTab: "advocate",
  counters: [],
  recording: false,

  // Debate state
  realityRows: [],
  scrubRows: [],
  debateLoading: { advocate: false, reality: false, tone: false, synthesis: false },
  synthesizedDraft: null,
  showDiff: false,
  debateGenerated: false,
  activeCounterId: null,
  intent: "",
  analyzedDraftHash: "",
  staleRealityCheck: false,
  staleToneScrubber: false,

  // Version state
  activeVersion: null,
  condensing: false,

  setTopic: (id, title) =>
    set({
      topicId: id,
      topicTitle: title,
      gate: "seed",
      fitPending: true,
      selectedId: null,
      panelOpen: false,
      items: [],
      clusters: [],
      // Reset debate state
      counters: [],
      realityRows: [],
      scrubRows: [],
      synthesizedDraft: null,
      showDiff: false,
      debateGenerated: false,
      activeCounterId: null,
      intent: "",
      analyzedDraftHash: "",
      staleRealityCheck: false,
      staleToneScrubber: false,
      activeVersion: null,
      condensing: false,
    }),

  setGate: (g) =>
    set({ gate: g, panelOpen: g === "refine" }),

  setTool: (t) => set({ tool: t }),
  setZoom: (z) => set({ zoom: clamp(z, 0.2, 2.5) }),
  setPan: (p) => set({ pan: p }),
  zoomIn: () => set((s) => ({ zoom: clamp(s.zoom + 0.1, 0.2, 2.5) })),
  zoomOut: () => set((s) => ({ zoom: clamp(s.zoom - 0.1, 0.2, 2.5) })),
  zoomReset: () => set({ zoom: 0.75, pan: { x: 60, y: 60 } }),
  zoomToFit: (viewW, viewH) =>
    set((s) => {
      const all = [
        ...s.items.map((it) => ({ x: it.x, y: it.y, w: it.w, h: it.h })),
        ...s.clusters.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h })),
      ];
      if (all.length === 0) return { zoom: 0.75, pan: { x: 60, y: 60 }, fitPending: false };
      const PAD = 80;
      const minX = Math.min(...all.map((a) => a.x));
      const minY = Math.min(...all.map((a) => a.y));
      const maxX = Math.max(...all.map((a) => a.x + a.w));
      const maxY = Math.max(...all.map((a) => a.y + a.h));
      const contentW = maxX - minX + PAD * 2;
      const contentH = maxY - minY + PAD * 2;
      const z = clamp(Math.min(viewW / contentW, viewH / contentH), 0.2, 1);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      return { zoom: z, pan: { x: viewW / 2 - cx * z, y: viewH / 2 - cy * z }, fitPending: false };
    }),

  setItems: (items) => set({ items }),
  setClusters: (clusters) => set({ clusters }),
  selectItem: (id) => set({ selectedId: id }),
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (id) =>
    set((s) => ({
      items: s.items.filter((it) => it.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),
  updateItem: (id, patch) =>
    set((s) => ({
      items: s.items.map((it) =>
        it.id === id ? ({ ...it, ...patch } as CanvasItem) : it
      ),
    })),
  moveItem: (id, x, y) =>
    set((s) => ({
      items: s.items.map((it) =>
        it.id === id ? ({ ...it, x, y } as CanvasItem) : it
      ),
    })),

  setSelectedIds: (ids) => set({ selectedIds: ids }),
  toggleSelectedId: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((i) => i !== id)
        : [...s.selectedIds, id],
    })),
  clearMultiSelection: () => set({ selectedIds: [] }),

  renameCluster: (id, label) =>
    set((s) => ({
      clusters: s.clusters.map((c) => (c.id === id ? { ...c, label } : c)),
    })),
  removeCluster: (id) =>
    set((s) => ({ clusters: s.clusters.filter((c) => c.id !== id) })),
  addCluster: (cluster) =>
    set((s) => ({ clusters: [...s.clusters, cluster] })),
  updateCluster: (id, patch) =>
    set((s) => ({
      clusters: s.clusters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setPanelOpen: (open) => set({ panelOpen: open }),
  toggleSources: () => set((s) => ({ sourcesOpen: !s.sourcesOpen })),
  setSourcesOpen: (open) => set({ sourcesOpen: open }),
  setRingTab: (t) => set({ ringTab: t }),
  setCounterStatus: (id, status) =>
    set((s) => ({
      counters: s.counters.map((c) =>
        c.id === id
          ? { ...c, status, revisionNote: status === "adopted" ? c.body : c.revisionNote }
          : c
      ),
    })),

  toggleRecording: () => set((s) => ({ recording: !s.recording })),

  pushUndo: () => {
    const { items, clusters } = useStore.getState();
    undoStack.push({ items: items.map((i) => ({ ...i })), clusters: clusters.map((c) => ({ ...c })) });
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
  },

  undo: () => {
    const snap = undoStack.pop();
    if (!snap) return;
    const { items, clusters } = useStore.getState();
    redoStack.push({ items: items.map((i) => ({ ...i })), clusters: clusters.map((c) => ({ ...c })) });
    set({ items: snap.items, clusters: snap.clusters });
  },

  redo: () => {
    const snap = redoStack.pop();
    if (!snap) return;
    const { items, clusters } = useStore.getState();
    undoStack.push({ items: items.map((i) => ({ ...i })), clusters: clusters.map((c) => ({ ...c })) });
    set({ items: snap.items, clusters: snap.clusters });
  },

  // Debate actions
  setCounters: (counters) => set({ counters }),
  setRealityRows: (rows) => set({ realityRows: rows }),
  setActiveCounterId: (id) => set({ activeCounterId: id }),
  setScrubRows: (rows) => set({ scrubRows: rows }),
  setScrubAccepted: (index, accepted) =>
    set((s) => ({
      scrubRows: s.scrubRows.map((r, i) => (i === index ? { ...r, accepted } : r)),
    })),
  setDebateLoading: (key, loading) =>
    set((s) => ({ debateLoading: { ...s.debateLoading, [key]: loading } })),
  updateCounter: (id, patch) =>
    set((s) => ({
      counters: s.counters.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      ),
    })),
  setSynthesizedDraft: (draft) => set({ synthesizedDraft: draft }),
  setShowDiff: (show) => set({ showDiff: show }),
  setDebateGenerated: (v) => set({ debateGenerated: v }),
  setIntent: (intent) => set({ intent }),
  resetDebate: () => set({
    counters: [],
    realityRows: [],
    scrubRows: [],
    synthesizedDraft: null,
    showDiff: false,
    debateGenerated: false,
    activeCounterId: null,
    debateLoading: { advocate: false, reality: false, tone: false, synthesis: false },
    analyzedDraftHash: "",
    staleRealityCheck: false,
    staleToneScrubber: false,
  }),
  setAnalyzedDraftHash: (hash) => set({ analyzedDraftHash: hash }),
  markRealityStale: () => set({ staleRealityCheck: true }),
  markToneStale: () => set({ staleToneScrubber: true }),
  clearRealityStale: () => set({ staleRealityCheck: false }),
  clearToneStale: () => set({ staleToneScrubber: false }),
  commitSynthesis: () =>
    set((s) => {
      if (!s.synthesizedDraft) return s;
      const draftId = s.items.find((i) => i.kind === "draft")?.id;
      if (!draftId) return s;
      return {
        items: s.items.map((it) =>
          it.id === draftId ? ({ ...it, ...s.synthesizedDraft } as CanvasItem) : it
        ),
        synthesizedDraft: null,
        showDiff: false,
        staleRealityCheck: true,
        staleToneScrubber: true,
      };
    }),

  // Version actions
  setActiveVersion: (platform) => set({ activeVersion: platform }),
  setCondensing: (v) => set({ condensing: v }),
  updateVersion: (draftId, platform, patch) =>
    set((s) => ({
      items: s.items.map((it) => {
        if (it.id !== draftId || it.kind !== "draft") return it;
        const draft = it as DraftItem;
        const existing = draft.versions?.[platform] ?? {
          platform,
          title: "",
          body: [],
          wordCount: 0,
          updatedAt: Date.now(),
        };
        return {
          ...draft,
          versions: {
            ...draft.versions,
            [platform]: { ...existing, ...patch, updatedAt: Date.now() },
          },
        } as CanvasItem;
      }),
    })),
  removeVersion: (draftId, platform) =>
    set((s) => ({
      items: s.items.map((it) => {
        if (it.id !== draftId || it.kind !== "draft") return it;
        const draft = it as DraftItem;
        const { [platform]: _, ...rest } = draft.versions ?? {};
        return {
          ...draft,
          versions: Object.keys(rest).length > 0 ? rest : undefined,
        } as CanvasItem;
      }),
      activeVersion: s.activeVersion === platform ? null : s.activeVersion,
    })),
}));
