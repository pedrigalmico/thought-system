"use client";

import { useState } from "react";
import { Loader2, ArrowRight, Eye } from "lucide-react";
import { useStore } from "@/store/useStore";
import { synthesizeDraft } from "@/lib/ai";
import { saveItem } from "@/lib/db";
import type { DraftItem } from "@/lib/types";

export function SynthesisFooter() {
  const counters = useStore((s) => s.counters);
  const items = useStore((s) => s.items);
  const scrubRows = useStore((s) => s.scrubRows);
  const topicId = useStore((s) => s.topicId);
  const setSynthesizedDraft = useStore((s) => s.setSynthesizedDraft);
  const synthesizedDraft = useStore((s) => s.synthesizedDraft);
  const showDiff = useStore((s) => s.showDiff);
  const setShowDiff = useStore((s) => s.setShowDiff);
  const commitSynthesis = useStore((s) => s.commitSynthesis);
  const setGate = useStore((s) => s.setGate);
  const updateItem = useStore((s) => s.updateItem);

  const [loading, setLoading] = useState(false);

  const draft = items.find((i) => i.kind === "draft") as DraftItem | undefined;
  const resolved = counters.filter((c) => c.status !== "open").length;
  const total = counters.length;
  const allResolved = total > 0 && resolved === total;
  const adopted = counters.filter((c) => c.status === "adopted");
  const dismissed = counters.filter((c) => c.status === "dismissed");
  const acceptedScrubs = scrubRows.filter((s) => s.accepted);

  const handleSynthesize = async () => {
    if (!draft || loading) return;
    setLoading(true);
    try {
      const result = await synthesizeDraft(draft, adopted, acceptedScrubs.length > 0 ? acceptedScrubs : undefined);
      const synthDraft: DraftItem = {
        ...draft,
        title: result.title,
        body: result.body,
        wordCount: result.wordCount,
        slopFlags: result.slopFlags,
      };
      setSynthesizedDraft(synthDraft);
    } catch (err) {
      console.error("Synthesis error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveToRefine = async () => {
    commitSynthesis();
    // Persist the updated draft to Firestore
    if (topicId) {
      const updatedDraft = items.find((i) => i.kind === "draft");
      if (updatedDraft && synthesizedDraft) {
        try {
          await saveItem(topicId, { ...updatedDraft, ...synthesizedDraft } as DraftItem);
        } catch (e) {
          console.error("Failed to save synthesized draft:", e);
        }
      }
    }
    setGate("refine");
  };

  return (
    <div className="synthesis-footer">
      <div className="progress-dots">
        {counters.map((c) => (
          <div
            key={c.id}
            className={`progress-dot ${c.status !== "open" ? "filled" : ""}`}
          />
        ))}
        <span className="progress-label">
          {resolved} of {total} resolved
        </span>
      </div>

      {synthesizedDraft ? (
        <>
          <div className="synthesis-summary">
            Draft synthesized — {synthesizedDraft.wordCount} words
          </div>
          <div className="synthesis-actions">
            <button
              className="btn ghost"
              onClick={() => setShowDiff(!showDiff)}
            >
              <Eye size={12} />
              {showDiff ? "Hide changes" : "View changes"}
            </button>
            <button className="btn primary" onClick={handleMoveToRefine}>
              Move to Refine
              <ArrowRight size={12} />
            </button>
          </div>
        </>
      ) : allResolved ? (
        <>
          <div className="synthesis-summary">
            {adopted.length} adopted · {dismissed.length} dismissed
            {acceptedScrubs.length > 0 && ` · ${acceptedScrubs.length} tone fixes`}
          </div>
          <button
            className="btn primary"
            onClick={handleSynthesize}
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading ? (
              <>
                <Loader2 size={12} className="spin" /> Synthesizing…
              </>
            ) : (
              "Synthesize Draft →"
            )}
          </button>
        </>
      ) : (
        <div className="synthesis-summary">
          Resolve all counters to synthesize your draft.
        </div>
      )}
    </div>
  );
}
