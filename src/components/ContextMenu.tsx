"use client";

import { useEffect, useRef } from "react";
import { StickyNote, Link2, ImageIcon, Film, Mic, FileText } from "lucide-react";

export type ContextAction = "draft" | "note" | "link" | "image" | "video" | "voice";

interface Props {
  x: number;
  y: number;
  onSelect: (action: ContextAction) => void;
  onClose: () => void;
}

const ITEMS: { id: ContextAction; Icon: React.ComponentType<{ size?: number }>; label: string }[] = [
  { id: "draft", Icon: FileText, label: "Draft" },
  { id: "note", Icon: StickyNote, label: "Note" },
  { id: "link", Icon: Link2, label: "URL" },
  { id: "image", Icon: ImageIcon, label: "Image" },
  { id: "video", Icon: Film, label: "Video" },
  { id: "voice", Icon: Mic, label: "Record" },
];

export function ContextMenu({ x, y, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="ctx-menu" style={{ left: x, top: y }}>
      {ITEMS.map((item) => (
        <button
          key={item.id}
          className="ctx-item"
          onClick={() => onSelect(item.id)}
        >
          <item.Icon size={16} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
