"use client";

import { useStore } from "@/store/useStore";
import { StickyNote, Link2, Mic, Image, Video } from "lucide-react";

const ICONS: Record<string, typeof StickyNote> = {
  note: StickyNote,
  link: Link2,
  voice: Mic,
  image: Image,
  video: Video,
};

function chipLabel(item: import("@/lib/types").CanvasItem): string {
  switch (item.kind) {
    case "note":
      return item.body.replace(/<[^>]+>/g, "").slice(0, 40);
    case "link":
      return item.host;
    case "voice":
      return item.duration;
    case "image":
      return item.caption || item.alt || "Image";
    case "video":
      return item.title.slice(0, 30);
    default:
      return "";
  }
}

export function SourceStrip() {
  const items = useStore((s) => s.items);
  const sources = items.filter((i) => i.kind !== "draft");

  if (sources.length === 0) return null;

  const grouped = sources.reduce<Record<string, number>>((acc, i) => {
    acc[i.kind] = (acc[i.kind] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="source-strip">
      <div className="source-strip-label">Source material</div>
      <div className="source-strip-items">
        {sources.map((item) => {
          const Icon = ICONS[item.kind] || StickyNote;
          return (
            <div key={item.id} className="source-chip" title={chipLabel(item)}>
              <Icon size={12} />
              <span className="source-chip-text">{chipLabel(item)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
