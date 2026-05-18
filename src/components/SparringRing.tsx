"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Crosshair, Pencil, Zap, RotateCw, RefreshCw, Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { PushBackDialog } from "./debate/PushBackDialog";
import { SynthesisFooter } from "./debate/SynthesisFooter";
import { saveIntent, saveDebateState } from "@/lib/db";
import { analyzeDraft, checkReality, scrubTone } from "@/lib/ai";
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

  const activeCounterId = useStore((s) => s.activeCounterId);
  const setActiveCounterId = useStore((s) => s.setActiveCounterId);

  const intent = useStore((s) => s.intent);
  const setIntent = useStore((s) => s.setIntent);
  const topicId = useStore((s) => s.topicId);
  const setCounters = useStore((s) => s.setCounters);
  const setRealityRows = useStore((s) => s.setRealityRows);
  const setScrubRows = useStore((s) => s.setScrubRows);
  const setDebateLoading = useStore((s) => s.setDebateLoading);
  const debateGenerated = useStore((s) => s.debateGenerated);
  const setDebateGenerated = useStore((s) => s.setDebateGenerated);
  const resetDebate = useStore((s) => s.resetDebate);
  const staleRealityCheck = useStore((s) => s.staleRealityCheck);
  const staleToneScrubber = useStore((s) => s.staleToneScrubber);
  const clearRealityStale = useStore((s) => s.clearRealityStale);
  const clearToneStale = useStore((s) => s.clearToneStale);

  const [pushBackId, setPushBackId] = useState<string | null>(null);
  const [intentEditing, setIntentEditing] = useState(false);
  const [intentDraft, setIntentDraft] = useState(intent);
  const intentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setIntentDraft(intent); }, [intent]);

  const autoResize = useCallback(() => {
    const ta = intentRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }, []);

  useEffect(() => {
    if (intentEditing && intentRef.current) {
      intentRef.current.focus();
      intentRef.current.setSelectionRange(intentRef.current.value.length, intentRef.current.value.length);
      requestAnimationFrame(autoResize);
    }
  }, [intentEditing, autoResize]);

  const commitIntent = useCallback(() => {
    const trimmed = intentDraft.trim();
    setIntent(trimmed);
    setIntentEditing(false);
    if (topicId) saveIntent(topicId, trimmed).catch(console.error);
  }, [intentDraft, topicId, setIntent]);

  const runAnalysis = useCallback(async () => {
    const d = items.find((i) => i.kind === "draft") as DraftItem | undefined;
    if (!d || (!d.title && d.body.length === 0)) return;

    resetDebate();
    setDebateLoading("advocate", true);

    try {
      const currentIntent = useStore.getState().intent || undefined;
      const result = await analyzeDraft(d, currentIntent);

      setCounters(result.counters);
      setRealityRows(result.claims);
      setScrubRows(result.scrubs);
      setDebateGenerated(true);

      if (topicId) {
        saveDebateState(topicId, {
          counters: result.counters,
          realityRows: result.claims,
          scrubRows: result.scrubs,
        }).catch(console.error);
      }
    } catch (err) {
      console.error("Analysis error:", err);
    } finally {
      setDebateLoading("advocate", false);
    }
  }, [items, topicId, resetDebate, setCounters, setRealityRows, setScrubRows, setDebateLoading, setDebateGenerated]);

  const [refreshingTab, setRefreshingTab] = useState<"reality" | "tone" | null>(null);

  const refreshReality = useCallback(async () => {
    const d = items.find((i) => i.kind === "draft") as DraftItem | undefined;
    if (!d) return;
    setRefreshingTab("reality");
    try {
      const currentIntent = useStore.getState().intent || undefined;
      const rows = await checkReality(d, currentIntent);
      setRealityRows(rows);
      clearRealityStale();
    } catch (err) {
      console.error("Reality refresh error:", err);
    } finally {
      setRefreshingTab(null);
    }
  }, [items, setRealityRows, clearRealityStale]);

  const refreshTone = useCallback(async () => {
    const d = items.find((i) => i.kind === "draft") as DraftItem | undefined;
    if (!d) return;
    setRefreshingTab("tone");
    try {
      const currentIntent = useStore.getState().intent || undefined;
      const rows = await scrubTone(d, currentIntent);
      setScrubRows(rows);
      clearToneStale();
    } catch (err) {
      console.error("Tone refresh error:", err);
    } finally {
      setRefreshingTab(null);
    }
  }, [items, setScrubRows, clearToneStale]);

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
          <div className="panel-title">Challenge your draft</div>
        </div>
        <button className="panel-close" onClick={closePanel} aria-label="Close panel">
          <X size={14} />
        </button>
      </div>

      {/* ── Intent (North Star) ── */}
      <div className="intent-section">
        <div className="intent-header">
          <div className="intent-label">
            <Crosshair size={12} />
            Intent
          </div>
          {intent && !intentEditing && (
            <button className="intent-edit" onClick={() => setIntentEditing(true)} aria-label="Edit intent">
              <Pencil size={11} />
            </button>
          )}
        </div>

        {!intent && !intentEditing ? (
          <button className="intent-empty" onClick={() => setIntentEditing(true)}>
            What should the reader think, feel, or do?
          </button>
        ) : intentEditing ? (
          <div className="intent-editor">
            <textarea
              ref={intentRef}
              className="intent-textarea"
              value={intentDraft}
              onChange={(e) => { setIntentDraft(e.target.value); autoResize(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitIntent(); }
                if (e.key === "Escape") { setIntentDraft(intent); setIntentEditing(false); }
              }}
              placeholder="e.g. Get DMs from ops leaders asking about our automation approach"
              rows={1}
            />
            <div className="intent-actions">
              <button className="intent-save" onClick={commitIntent}>Set</button>
              <button className="intent-cancel" onClick={() => { setIntentDraft(intent); setIntentEditing(false); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="intent-value">{intent}</div>
        )}
      </div>

      {/* ── Analyze trigger ── */}
      {!debateGenerated && !debateLoading.advocate ? (
        <div className="analyze-section">
          <button
            className="analyze-btn"
            onClick={runAnalysis}
            disabled={!draft || (!draft.title && draft.body.length === 0)}
          >
            <Zap size={13} />
            Analyze Draft
          </button>
          <div className="analyze-hint">AI will challenge your draft from multiple angles</div>
        </div>
      ) : debateGenerated && !debateLoading.advocate ? (
        <div className="reanalyze-bar">
          <button className="reanalyze-btn" onClick={runAnalysis}>
            <RotateCw size={11} />
            Re-analyze
          </button>
        </div>
      ) : null}

      {total > 0 && (
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
          {staleRealityCheck && <span className="stale-dot" />}
        </button>
        <button
          role="tab"
          aria-selected={ringTab === "tone"}
          className={`panel-tab ${ringTab === "tone" ? "active" : ""}`}
          onClick={() => setRingTab("tone")}
        >
          Tone Scrubber
          {staleToneScrubber && <span className="stale-dot" />}
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
                  No counters yet. Write your draft and they&apos;ll appear automatically.
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
                        onClick={(e) => { e.stopPropagation(); setCounterStatus(c.id, "adopted"); }}
                      >
                        Adopt
                      </button>
                      <button
                        className="counter-action"
                        onClick={(e) => { e.stopPropagation(); setCounterStatus(c.id, "dismissed"); }}
                      >
                        Dismiss
                      </button>
                      <button
                        className="counter-action"
                        onClick={(e) => { e.stopPropagation(); setPushBackId(c.id); }}
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

            {staleRealityCheck && (
              <div className="stale-banner">
                <span>Draft has changed since this analysis</span>
                <button className="stale-refresh" onClick={refreshReality} disabled={refreshingTab === "reality"}>
                  {refreshingTab === "reality" ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />}
                  Refresh
                </button>
              </div>
            )}

            {refreshingTab === "reality" ? (
              <>
                <div className="loading-skeleton skeleton-row" />
                <div className="loading-skeleton skeleton-row" />
                <div className="loading-skeleton skeleton-row" />
              </>
            ) : debateLoading.reality ? (
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

            {staleToneScrubber && (
              <div className="stale-banner">
                <span>Draft has changed since this analysis</span>
                <button className="stale-refresh" onClick={refreshTone} disabled={refreshingTab === "tone"}>
                  {refreshingTab === "tone" ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />}
                  Refresh
                </button>
              </div>
            )}

            {refreshingTab === "tone" ? (
              <>
                <div className="loading-skeleton skeleton-row" />
                <div className="loading-skeleton skeleton-row" />
              </>
            ) : debateLoading.tone ? (
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

      <SynthesisFooter />
    </aside>
  );
}
