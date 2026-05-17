"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import type { Gate } from "@/lib/types";
import { updateTopicGate } from "@/lib/db";

const GATES: { id: Gate; label: string }[] = [
  { id: "seed", label: "Seed" },
  { id: "debate", label: "Debate" },
  { id: "refine", label: "Refine" },
  { id: "export", label: "Export" },
];

export function Topbar() {
  const router = useRouter();
  const gate = useStore((s) => s.gate);
  const setGate = useStore((s) => s.setGate);
  const topicId = useStore((s) => s.topicId);
  const topicTitle = useStore((s) => s.topicTitle);

  const handleGate = async (id: Gate) => {
    setGate(id);
    if (topicId) {
      try { await updateTopicGate(topicId, id); } catch {}
    }
  };

  const GATE_IDX = GATES.findIndex((g) => g.id === gate);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden />
        {topicId ? (
          <>
            <Link href="/" style={{ color: "var(--ink-mute)", textDecoration: "none", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Console
            </Link>
            <span className="sep">/</span>
            <span className="doc">{topicTitle || "Topic"}</span>
          </>
        ) : (
          <span>The Director&apos;s Console</span>
        )}
      </div>

      <div className="topbar-spacer" />

      {topicId && (
        <div className="gates" role="tablist" aria-label="Maturity gates">
          {GATES.map((g, i) => {
            const done = i < GATE_IDX;
            const active = g.id === gate;
            return (
              <button
                key={g.id}
                role="tab"
                aria-selected={active}
                className={`gate ${active ? "active" : ""} ${done ? "done" : ""}`}
                onClick={() => handleGate(g.id)}
              >
                <span className="gate-dot" />
                {g.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="topbar-actions">
        {topicId ? (
          <>
            <button className="btn ghost" onClick={() => router.push("/")}>← Home</button>
            <button className="btn primary" onClick={() => handleGate("export")}>Export</button>
          </>
        ) : (
          <button className="btn ghost">Settings</button>
        )}
      </div>
    </header>
  );
}
