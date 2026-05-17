"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useStore } from "@/store/useStore";
import { SourceStrip } from "./SourceStrip";
import { generateCounters, checkReality, scrubTone } from "@/lib/ai";
import { saveDebateState, loadDebateState } from "@/lib/db";
import type { DraftItem } from "@/lib/types";

function highlightText(text: string, quote: string): ReactNode {
  if (!quote) return text;
  const lower = text.toLowerCase();
  const target = quote.toLowerCase().trim();
  const idx = lower.indexOf(target);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="draft-highlight">{text.slice(idx, idx + target.length)}</mark>
      {text.slice(idx + target.length)}
    </>
  );
}

export function FocusedDraft({ topicId }: { topicId: string }) {
  const items = useStore((s) => s.items);
  const counters = useStore((s) => s.counters);
  const setCounters = useStore((s) => s.setCounters);
  const setRealityRows = useStore((s) => s.setRealityRows);
  const setScrubRows = useStore((s) => s.setScrubRows);
  const setDebateLoading = useStore((s) => s.setDebateLoading);
  const debateGenerated = useStore((s) => s.debateGenerated);
  const setDebateGenerated = useStore((s) => s.setDebateGenerated);
  const synthesizedDraft = useStore((s) => s.synthesizedDraft);
  const showDiff = useStore((s) => s.showDiff);
  const activeCounterId = useStore((s) => s.activeCounterId);

  const draft = items.find((i) => i.kind === "draft") as DraftItem | undefined;
  const activeQuote = counters.find((c) => c.id === activeCounterId)?.quote ?? null;

  useEffect(() => {
    if (!draft || debateGenerated) return;
    if (!draft.title && draft.body.length === 0) return;

    let cancelled = false;

    async function runDebate() {
      // Try loading saved debate state first
      const saved = await loadDebateState(topicId);
      if (saved && saved.counters.length > 0) {
        if (cancelled) return;
        setCounters(saved.counters);
        setRealityRows(saved.realityRows);
        setScrubRows(saved.scrubRows);
        setDebateGenerated(true);
        return;
      }

      // Fire all 3 AI calls in parallel
      setDebateLoading("advocate", true);
      setDebateLoading("reality", true);
      setDebateLoading("tone", true);

      const [countersResult, realityResult, toneResult] = await Promise.allSettled([
        generateCounters(draft!),
        checkReality(draft!),
        scrubTone(draft!),
      ]);

      if (cancelled) return;

      const newCounters = countersResult.status === "fulfilled" ? countersResult.value : [];
      const newReality = realityResult.status === "fulfilled" ? realityResult.value : [];
      const newScrubs = toneResult.status === "fulfilled" ? toneResult.value : [];

      setCounters(newCounters);
      setRealityRows(newReality);
      setScrubRows(newScrubs);
      setDebateLoading("advocate", false);
      setDebateLoading("reality", false);
      setDebateLoading("tone", false);
      setDebateGenerated(true);

      // Persist to Firestore
      saveDebateState(topicId, {
        counters: newCounters,
        realityRows: newReality,
        scrubRows: newScrubs,
      }).catch(console.error);
    }

    runDebate();
    return () => { cancelled = true; };
  }, [draft, debateGenerated, topicId]);

  if (!draft) {
    return (
      <div className="focused-draft-wrap">
        <div className="focused-draft-empty">
          <div className="panel-empty-text">
            Create a draft card in Seed before entering Debate.
          </div>
          <div className="panel-empty-hint">
            Right-click on the canvas → Add Draft
          </div>
        </div>
      </div>
    );
  }

  const adoptedCounters = counters.filter((c) => c.status === "adopted");
  const displayDraft = synthesizedDraft || draft;

  return (
    <div className="focused-draft-wrap">
      <div className="focused-draft">
        {displayDraft.pretitle && (
          <div className="draft-pretitle">{displayDraft.pretitle}</div>
        )}
        <h1 className="focused-draft-title">{displayDraft.title}</h1>
        <div className="focused-draft-body">
          {displayDraft.body.map((p, i) => (
            <p key={i}>{activeQuote ? highlightText(p, activeQuote) : p}</p>
          ))}
        </div>
        <div className="draft-stats">
          <span>{displayDraft.wordCount} words</span>
          {displayDraft.slopFlags > 0 && (
            <span>{displayDraft.slopFlags} slop flags</span>
          )}
          {synthesizedDraft && <span className="synthesized-badge">Synthesized</span>}
        </div>

        {adoptedCounters.length > 0 && !synthesizedDraft && (
          <div className="adopted-revisions">
            <div className="ring-section-label">Adopted revisions</div>
            {adoptedCounters.map((c) => (
              <div key={c.id} className="adopted-revision">
                <span className="adopted-stance">{c.stance}</span>
                <span className="adopted-text">{c.revisionNote || c.body}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <SourceStrip />
    </div>
  );
}
