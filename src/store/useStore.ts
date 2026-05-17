"use client";

import { create } from "zustand";
import type { CanvasItem, Cluster, Counter, DraftItem, Gate, RealityRow, ScrubRow, Tool } from "@/lib/types";
import { SAMPLE_CLUSTERS, SAMPLE_COUNTERS } from "@/lib/data";

type RingTab = "advocate" | "reality" | "tone";

interface DebateLoading {
  advocate: boolean;
  reality: boolean;
  tone: boolean;
  synthesis: boolean;
}

interface State {
  topicId: string | null;
  topicTitle: string;
  gate: Gate;
  tool: Tool;
  zoom: number;
  pan: { x: number; y: number };

  items: CanvasItem[];
  clusters: Cluster[];
  selectedId: string | null;

  panelOpen: boolean;
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

  setTopic: (id: string, title: string) => void;
  setGate: (g: Gate) => void;
  setTool: (t: Tool) => void;
  setZoom: (z: number) => void;
  setPan: (p: { x: number; y: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;

  setItems: (items: CanvasItem[]) => void;
  setClusters: (clusters: Cluster[]) => void;
  selectItem: (id: string | null) => void;
  addItem: (item: CanvasItem) => void;
  updateItem: (id: string, patch: Partial<CanvasItem>) => void;
  removeItem: (id: string) => void;
  moveItem: (id: string, x: number, y: number) => void;

  renameCluster: (id: string, label: string) => void;
  removeCluster: (id: string) => void;

  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
  setRingTab: (t: RingTab) => void;
  setCounterStatus: (id: string, status: Counter["status"]) => void;

  toggleRecording: () => void;

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
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const useStore = create<State>((set) => ({
  topicId: null,
  topicTitle: "",
  gate: "seed",
  tool: "select",
  zoom: 0.75,
  pan: { x: 60, y: 60 },

  items: [],
  clusters: SAMPLE_CLUSTERS,
  selectedId: null,

  panelOpen: false,
  ringTab: "advocate",
  counters: SAMPLE_COUNTERS,
  recording: false,

  // Debate state
  realityRows: [],
  scrubRows: [],
  debateLoading: { advocate: false, reality: false, tone: false, synthesis: false },
  synthesizedDraft: null,
  showDiff: false,
  debateGenerated: false,
  activeCounterId: null,

  setTopic: (id, title) =>
    set({
      topicId: id,
      topicTitle: title,
      gate: "seed",
      zoom: 0.75,
      pan: { x: 60, y: 60 },
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
    }),

  setGate: (g) =>
    set({ gate: g, panelOpen: g === "debate" || g === "refine" }),

  setTool: (t) => set({ tool: t }),
  setZoom: (z) => set({ zoom: clamp(z, 0.2, 2.5) }),
  setPan: (p) => set({ pan: p }),
  zoomIn: () => set((s) => ({ zoom: clamp(s.zoom + 0.1, 0.2, 2.5) })),
  zoomOut: () => set((s) => ({ zoom: clamp(s.zoom - 0.1, 0.2, 2.5) })),
  zoomReset: () => set({ zoom: 0.75, pan: { x: 60, y: 60 } }),

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

  renameCluster: (id, label) =>
    set((s) => ({
      clusters: s.clusters.map((c) => (c.id === id ? { ...c, label } : c)),
    })),
  removeCluster: (id) =>
    set((s) => ({ clusters: s.clusters.filter((c) => c.id !== id) })),

  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setPanelOpen: (open) => set({ panelOpen: open }),
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
      };
    }),
}));
