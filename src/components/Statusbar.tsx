"use client";

import { useStore } from "@/store/useStore";

export function Statusbar() {
  const items = useStore((s) => s.items.length);
  const clusters = useStore((s) => s.clusters.length);
  const zoom = useStore((s) => s.zoom);
  const gate = useStore((s) => s.gate);

  return (
    <footer className="statusbar">
      <div className="item">
        <span className="pip coral" /> {gate}
      </div>
      <div className="item">{items} items</div>
      <div className="item">{clusters} clusters</div>
      <div className="spacer" />
      <div className="item">Local · IndexedDB</div>
      <div className="item">{Math.round(zoom * 100)}%</div>
    </footer>
  );
}
