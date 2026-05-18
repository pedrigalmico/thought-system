"use client";

import { useCallback, useState } from "react";
import { useStore } from "@/store/useStore";
import type { CanvasItem, DraftItem, ImageItem, LinkItem, VideoItem } from "@/lib/types";

const FORMATS = [
  { id: "cms", title: "Copy for CMS", desc: "Rich HTML · paste into any CMS editor with formatting preserved" },
  { id: "linkedin", title: "LinkedIn Carousel", desc: "10 slides · 1080×1080 · chunked by paragraph" },
  { id: "longform", title: "Long-form Essay", desc: "Clean PDF · essay layout · print-ready" },
  { id: "ppt", title: "PPT Outline", desc: "One slide per heading · pptxgenjs" },
  { id: "case-study", title: "Case Study", desc: "Markdown download · structured narrative" },
];

function buildCmsHtml(draft: DraftItem, items: CanvasItem[]): string {
  const images = items.filter((i): i is ImageItem => i.kind === "image" && !!i.src);
  const links = items.filter((i): i is LinkItem => i.kind === "link");
  const videos = items.filter((i): i is VideoItem => i.kind === "video");

  const parts: string[] = [];

  if (draft.title) {
    parts.push(`<h1>${draft.title}</h1>`);
  }

  for (const p of draft.body) {
    const isHeading = /^<(h[1-6])\b/.test(p.trim());
    if (isHeading) {
      parts.push(p);
    } else if (p.startsWith("<")) {
      parts.push(p);
    } else {
      parts.push(`<p>${p}</p>`);
    }
  }

  if (images.length > 0) {
    for (const img of images) {
      const alt = img.alt || img.caption || "";
      parts.push(`<figure><img src="${img.src}" alt="${alt}" />${img.caption ? `<figcaption>${img.caption}</figcaption>` : ""}</figure>`);
    }
  }

  if (videos.length > 0) {
    for (const vid of videos) {
      const ytId = vid.thumb?.match(/\/vi\/([A-Za-z0-9_-]{11})\//)?.[1];
      if (ytId) {
        parts.push(`<figure><iframe width="560" height="315" src="https://www.youtube.com/embed/${ytId}" frameborder="0" allowfullscreen></iframe></figure>`);
      }
    }
  }

  if (links.length > 0) {
    for (const link of links) {
      const url = link.title.startsWith("http") ? link.title : `https://${link.host}`;
      parts.push(`<p><a href="${url}">${link.host} — ${link.snippet}</a></p>`);
    }
  }

  return parts.join("\n");
}

export function ExportPanel() {
  const topicTitle = useStore((s) => s.topicTitle);
  const items = useStore((s) => s.items);
  const draft = items.find((i) => i.kind === "draft") as DraftItem | undefined;
  const [copied, setCopied] = useState(false);

  const handleExport = useCallback(async (formatId: string) => {
    if (formatId === "cms") {
      if (!draft) return;
      const html = buildCmsHtml(draft, items);

      const blob = new Blob([html], { type: "text/html" });
      const plainText = draft.body.join("\n\n");

      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": blob,
            "text/plain": new Blob([plainText], { type: "text/plain" }),
          }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = html;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, [draft, items]);

  return (
    <div className="export-panel-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24, position: "relative", overflow: "hidden", background: "var(--bg)" }}>
      <div className="canvas-bg" />
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 640, width: "100%", padding: "0 24px" }}>
        <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--coral)", marginBottom: 10 }}>
          Export · {topicTitle}
        </div>
        {draft && (
          <div style={{ fontFamily: "var(--font-plex-serif)", fontSize: 24, color: "var(--ink)", marginBottom: 8, fontWeight: 400 }}>
            {draft.title}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 32 }}>
          Choose a format to generate your export
        </div>
        <div className="export-formats">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              className={`export-format-card${f.id === "cms" ? " cms-card" : ""}`}
              onClick={() => handleExport(f.id)}
            >
              <div className="export-format-title">
                {f.id === "cms" && copied ? "Copied!" : f.title}
              </div>
              <div className="export-format-desc">{f.desc}</div>
            </button>
          ))}
        </div>

        {draft && (
          <div style={{ marginTop: 32, textAlign: "left" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 12 }}>
              Preview
            </div>
            <div
              className="cms-preview"
              dangerouslySetInnerHTML={{ __html: buildCmsHtml(draft, items) }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
