"use client";

import { useState, useMemo } from "react";
import {
  X,
  StickyNote,
  Image as ImageIcon,
  Link as LinkIcon,
  Video,
  Mic,
  ChevronDown,
  Search,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import type { CanvasItem, ItemKind } from "@/lib/types";

const KIND_ICON: Record<string, typeof StickyNote> = {
  note: StickyNote,
  image: ImageIcon,
  link: LinkIcon,
  video: Video,
  voice: Mic,
};

const KIND_LABEL: Record<string, string> = {
  note: "Note",
  image: "Image",
  link: "Link",
  video: "Video",
  voice: "Voice",
};

const FILTER_KINDS: ItemKind[] = ["note", "image", "link", "video", "voice"];

function getSearchableText(item: CanvasItem): string {
  switch (item.kind) {
    case "note":
      return item.body.replace(/<[^>]+>/g, "");
    case "image":
      return [item.caption, item.alt].filter(Boolean).join(" ");
    case "link":
      return [item.title, item.host, item.snippet].filter(Boolean).join(" ");
    case "video":
      return item.title;
    case "voice":
      return item.transcript;
    default:
      return "";
  }
}

export function SourcesPanel() {
  const items = useStore((s) => s.items);
  const toggleSources = useStore((s) => s.toggleSources);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ItemKind | null>(null);

  const allSources = items.filter((i) => i.kind !== "draft");

  const kindCounts = useMemo(() => {
    const counts: Partial<Record<ItemKind, number>> = {};
    for (const s of allSources) {
      counts[s.kind] = (counts[s.kind] ?? 0) + 1;
    }
    return counts;
  }, [allSources]);

  const availableKinds = FILTER_KINDS.filter((k) => (kindCounts[k] ?? 0) > 0);

  const filtered = useMemo(() => {
    let result = allSources;
    if (activeFilter) {
      result = result.filter((i) => i.kind === activeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i) => getSearchableText(i).toLowerCase().includes(q));
    }
    return result;
  }, [allSources, activeFilter, search]);

  return (
    <aside className="sources-panel" aria-label="Sources">
      <div className="sources-head">
        <div>
          <div className="sources-eyebrow">Sources</div>
          <div className="sources-count">
            {allSources.length} {allSources.length === 1 ? "item" : "items"} from seed
          </div>
        </div>
        <button className="panel-close" onClick={toggleSources} aria-label="Close sources">
          <X size={14} />
        </button>
      </div>

      {allSources.length > 0 && (
        <div className="sources-filters">
          <div className="sources-search">
            <Search size={12} className="sources-search-icon" />
            <input
              type="text"
              className="sources-search-input"
              placeholder="Search sources…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="sources-search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={10} />
              </button>
            )}
          </div>

          {availableKinds.length > 1 && (
            <div className="sources-kind-chips">
              <button
                className={`sources-chip ${activeFilter === null ? "active" : ""}`}
                onClick={() => setActiveFilter(null)}
              >
                All
              </button>
              {availableKinds.map((kind) => {
                const Icon = KIND_ICON[kind];
                return (
                  <button
                    key={kind}
                    className={`sources-chip ${activeFilter === kind ? "active" : ""}`}
                    onClick={() => setActiveFilter(activeFilter === kind ? null : kind)}
                  >
                    <Icon size={10} />
                    {KIND_LABEL[kind]}
                    <span className="sources-chip-count">{kindCounts[kind]}</span>
                  </button>
                );
              })}
            </div>
          )}

          {(search || activeFilter) && (
            <div className="sources-filter-status">
              {filtered.length} {filtered.length === 1 ? "result" : "results"}
              {activeFilter && ` in ${KIND_LABEL[activeFilter]}s`}
            </div>
          )}
        </div>
      )}

      <div className="sources-body">
        {allSources.length === 0 ? (
          <div className="sources-empty">
            <div className="sources-empty-icon">
              <StickyNote size={24} />
            </div>
            <p>No sources yet</p>
            <p className="sources-empty-hint">
              Add notes, images, and links in Seed — they appear here as reference while you write.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="sources-empty">
            <p>No matching sources</p>
            <p className="sources-empty-hint">
              Try a different search term or clear the filters.
            </p>
          </div>
        ) : (
          filtered.map((item) => <SourceCard key={item.id} item={item} />)
        )}
      </div>
    </aside>
  );
}

function SourceCard({ item }: { item: CanvasItem }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = KIND_ICON[item.kind] ?? StickyNote;
  const label = KIND_LABEL[item.kind] ?? item.kind;

  return (
    <div
      className={`source-card source-${item.kind} ${expanded ? "expanded" : ""}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="source-card-head">
        <Icon size={12} />
        <span className="source-kind">{label}</span>
        <ChevronDown size={12} className={`source-chevron ${expanded ? "open" : ""}`} />
      </div>

      {item.kind === "note" && (
        <div className={`source-text ${expanded ? "" : "clamped"}`}>
          {item.body.replace(/<[^>]+>/g, "")}
        </div>
      )}

      {item.kind === "image" && item.src && (
        <img
          className="source-thumb"
          src={item.src}
          alt={item.alt ?? ""}
          draggable={false}
        />
      )}

      {item.kind === "link" && (
        <>
          <div className="source-link-host">{item.host}</div>
          <div className={`source-text ${expanded ? "" : "clamped"}`}>
            {item.title}
          </div>
        </>
      )}

      {item.kind === "video" && (
        <>
          {item.thumb && (
            <img
              className="source-thumb"
              src={item.thumb}
              alt={item.title}
              draggable={false}
            />
          )}
          <div className="source-text clamped">{item.title}</div>
        </>
      )}

      {item.kind === "voice" && (
        <>
          <div className="source-voice-dur">{item.duration}</div>
          {expanded && item.transcript && (
            <div className="source-text">{item.transcript}</div>
          )}
        </>
      )}
    </div>
  );
}
