"use client";

import { useStore } from "@/store/useStore";

const FORMATS = [
  { id: "linkedin", title: "LinkedIn Carousel", desc: "10 slides · 1080×1080 · chunked by paragraph" },
  { id: "longform", title: "Long-form Essay", desc: "Clean PDF · essay layout · print-ready" },
  { id: "ppt", title: "PPT Outline", desc: "One slide per heading · pptxgenjs" },
  { id: "case-study", title: "Case Study", desc: "Markdown download · structured narrative" },
];

export function ExportPanel() {
  const topicTitle = useStore((s) => s.topicTitle);
  const items = useStore((s) => s.items);
  const draft = items.find((i) => i.kind === "draft");

  return (
    <div className="canvas-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24 }}>
      <div className="canvas-bg" />
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 640, width: "100%", padding: "0 24px" }}>
        <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--coral)", marginBottom: 10 }}>
          Export · {topicTitle}
        </div>
        {draft && draft.kind === "draft" && (
          <div style={{ fontFamily: "var(--font-plex-serif)", fontSize: 24, color: "var(--ink)", marginBottom: 8, fontWeight: 400 }}>
            {draft.title}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 32 }}>
          Choose a format to generate your export
        </div>
        <div className="export-formats">
          {FORMATS.map((f) => (
            <button key={f.id} className="export-format-card">
              <div className="export-format-title">{f.title}</div>
              <div className="export-format-desc">{f.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
