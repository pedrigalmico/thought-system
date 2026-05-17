"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useStore } from "@/store/useStore";
import { PushBackDialog } from "./debate/PushBackDialog";
import { SynthesisFooter } from "./debate/SynthesisFooter";
import type { DraftItem } from "@/lib/types";

export function SparringRing() {
  const ringTab = useStore((s) => s.ringTab);
  const setRingTab = useStore((s) => s.setRingTab);
  const counters = useStore((s) => s.counters);
  const setCounterStatus = useStore((s) => s.setCounterStatus);
  const closePanel = useStore((s) => s.togglePanel);
  const items = useStore((s) => s.items);
  const realityRows = useStore((s) => s.realityRows);
  const scrubRows = useStore((s) => s.scrubRows);
  const setScrubAccepted = useStore((s) => s.setScrubAccepted);
  const debateLoading = useStore((s) => s.debateLoading);
  const gate = useStore((s) => s.gate);

  const activeCounterId = useStore((s) => s.activeCounterId);
  const setActiveCounterId = useStore((s) => s.setActiveCounterId);

  const [pushBackId, setPushBackId] = useState<string | null>(null);

  const draft = items.find((i) => i.kind === "draft") as DraftItem | undefined;
  const resolved = counters.filter((c) => c.status !== "open").length;
  const total = counters.length;

  return (
    <aside className="panel" aria-label="Sparring Ring">
      <div className="panel-head">
        <div>
          <div className="panel-eyebrow">
            <span className="live-dot" />
            Sparring Ring · Live
          </div>
          <div className="panel-title">
            {gate === "debate" ? "Challenge your draft" : "Three counters to your draft"}
          </div>
        </div>
        <button className="panel-close" onClick={closePanel} aria-label="Close panel">
          <X size={14} />
        </button>
      </div>

      {gate === "debate" && total > 0 && (
        <div className="progress-dots">
          {counters.map((c) => (
            <div key={c.id} className={`progress-dot ${c.status !== "open" ? "filled" : ""}`} />
          ))}
          <span className="progress-label">{resolved} of {total} resolved</span>
        </div>
      )}

      <div className="panel-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={ringTab === "advocate"}
          className={`panel-tab ${ringTab === "advocate" ? "active" : ""}`}
          onClick={() => setRingTab("advocate")}
        >
          Devil&apos;s Advocate
        </button>
        <button
          role="tab"
          aria-selected={ringTab === "reality"}
          className={`panel-tab ${ringTab === "reality" ? "active" : ""}`}
          onClick={() => setRingTab("reality")}
        >
          Reality Check
        </button>
        <button
          role="tab"
          aria-selected={ringTab === "tone"}
          className={`panel-tab ${ringTab === "tone" ? "active" : ""}`}
          onClick={() => setRingTab("tone")}
        >
          Tone Scrubber
        </button>
      </div>

      <div className="panel-body">
        {/* ── Devil's Advocate ── */}
        {ringTab === "advocate" && (
          <>
            <div className="ring-section-label">Three Counters</div>

            {debateLoading.advocate ? (
              <>
                <div className="loading-skeleton skeleton-counter" />
                <div className="loading-skeleton skeleton-counter" />
                <div className="loading-skeleton skeleton-counter" />
              </>
            ) : counters.length === 0 ? (
              <div className="panel-empty">
                <div className="panel-empty-text">
                  No counters yet. Enter Debate with a draft to generate them.
                </div>
              </div>
            ) : (
              counters.map((c, i) => (
                <div
                  key={c.id}
                  className={`counter ${c.status !== "open" ? "counter-resolved" : ""} ${activeCounterId === c.id ? "counter-active" : ""}`}
                  onClick={() => setActiveCounterId(activeCounterId === c.id ? null : c.id)}
                >
                  <div className="counter-head">
                    <div className="counter-num">
                      <span className="n">{i + 1}</span>
                      Counter
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {c.quote && (
                        <div className="counter-locate-hint">
                          {activeCounterId === c.id ? "↑ highlighted" : "click to locate"}
                        </div>
                      )}
                      <div className="counter-stance">{c.stance}</div>
                    </div>
                  </div>
                  <div className="counter-body">{c.body}</div>

                  {c.status === "open" && pushBackId !== c.id && (
                    <div className="counter-actions">
                      <button
                        className="counter-action"
                        onClick={() => setCounterStatus(c.id, "adopted")}
                      >
                        Adopt
                      </button>
                      <button
                        className="counter-action"
                        onClick={() => setCounterStatus(c.id, "dismissed")}
                      >
                        Dismiss
                      </button>
                      <button
                        className="counter-action"
                        onClick={() => setPushBackId(c.id)}
                      >
                        Push back
                      </button>
                    </div>
                  )}

                  {c.status === "adopted" && (
                    <div className="counter-actions">
                      <button className="counter-action adopted">Adopted ✓</button>
                    </div>
                  )}

                  {c.status === "dismissed" && (
                    <div className="counter-actions">
                      <button className="counter-action" style={{ color: "var(--ink-faint)" }}>
                        Dismissed
                      </button>
                    </div>
                  )}

                  {pushBackId === c.id && c.status === "open" && draft && (
                    <PushBackDialog
                      counter={c}
                      draft={draft}
                      onClose={() => setPushBackId(null)}
                    />
                  )}

                  {c.pushBack && pushBackId !== c.id && (
                    <div className="counter-pushback">
                      <div className={`outcome-badge ${c.pushBack.outcome}`}>
                        {c.pushBack.outcome}
                      </div>
                      <div className="counter-ai-response">{c.pushBack.aiResponse}</div>
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* ── Reality Check ── */}
        {ringTab === "reality" && (
          <>
            <div className="ring-section-label">Claims & Sources</div>

            {debateLoading.reality ? (
              <>
                <div className="loading-skeleton skeleton-row" />
                <div className="loading-skeleton skeleton-row" />
                <div className="loading-skeleton skeleton-row" />
              </>
            ) : realityRows.length === 0 ? (
              <div className="panel-empty">
                <div className="panel-empty-text">
                  No factual claims detected, or still waiting for analysis.
                </div>
              </div>
            ) : (
              realityRows.map((r, i) => (
                <div key={i} className="reality-row">
                  <div className={`reality-icon ${r.verdict}`}>
                    {r.verdict === "ok" ? "✓" : r.verdict === "warn" ? "!" : "✗"}
                  </div>
                  <div>
                    <div className="reality-claim">{r.claim}</div>
                    <div className="reality-source">
                      {r.sourceUrl ? (
                        <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {r.source}
                        </a>
                      ) : (
                        r.source
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ── Tone Scrubber ── */}
        {ringTab === "tone" && (
          <>
            <div className="ring-section-label">Slop Flags</div>

            {debateLoading.tone ? (
              <>
                <div className="loading-skeleton skeleton-row" />
                <div className="loading-skeleton skeleton-row" />
              </>
            ) : scrubRows.length === 0 ? (
              <div className="panel-empty">
                <div className="panel-empty-text">
                  No slop detected. Your draft is clean.
                </div>
              </div>
            ) : (
              scrubRows.map((s, i) => (
                <div key={i} className="scrub-row">
                  <span className="scrub-word">{s.word}</span>
                  <div className="scrub-context">
                    <span className="scrub-strike">{s.before}</span>
                    {" → "}
                    <span className="scrub-replace">{s.after}</span>
                  </div>
                  <div className="scrub-actions">
                    <button
                      className={`scrub-action ${s.accepted === true ? "accepted" : ""}`}
                      onClick={() => setScrubAccepted(i, true)}
                    >
                      {s.accepted ? "Accepted ✓" : "Accept"}
                    </button>
                    <button
                      className={`scrub-action ${s.accepted === false ? "accepted" : ""}`}
                      onClick={() => setScrubAccepted(i, false)}
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {gate === "debate" ? (
        <SynthesisFooter />
      ) : (
        <div className="ring-input-area">
          <div className="ring-input-label">Push back</div>
          <textarea
            className="ring-input"
            placeholder="Reply to a counter, or ask for a different angle…"
          />
        </div>
      )}
    </aside>
  );
}
