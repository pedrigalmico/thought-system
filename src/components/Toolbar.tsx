"use client";

import { Fragment } from "react";
import { MousePointer2, BoxSelect, StickyNote, ImageIcon, Link2, Mic } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { Tool } from "@/lib/types";

const TOOLS: { id: Tool; Icon: React.ComponentType<{ size?: number }>; label: string }[] = [
  { id: "select", Icon: MousePointer2, label: "Select" },
  { id: "lasso", Icon: BoxSelect, label: "Lasso" },
  { id: "note", Icon: StickyNote, label: "Note" },
  { id: "image", Icon: ImageIcon, label: "Image" },
  { id: "link", Icon: Link2, label: "Link" },
  { id: "voice", Icon: Mic, label: "Voice" },
];

export function Toolbar() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);

  return (
    <div className="toolbar" role="toolbar" aria-label="Canvas tools">
      {TOOLS.map((t, i) => (
        <Fragment key={t.id}>
          <button
            className={`tool ${tool === t.id ? "active" : ""}`}
            aria-label={t.label}
            title={t.label}
            onClick={() => setTool(t.id)}
          >
            <t.Icon size={16} />
          </button>
          {i === 1 && <div className="tool-divider" />}
        </Fragment>
      ))}
    </div>
  );
}
