"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { pushBack as pushBackApi } from "@/lib/ai";
import { useStore } from "@/store/useStore";
import type { Counter, DraftItem } from "@/lib/types";

interface Props {
  counter: Counter;
  draft: DraftItem;
  onClose: () => void;
}

export function PushBackDialog({ counter, draft, onClose }: Props) {
  const [rebuttal, setRebuttal] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    outcome: "concede" | "hold" | "refine";
    response: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateCounter = useStore((s) => s.updateCounter);
  const setCounterStatus = useStore((s) => s.setCounterStatus);
  const intent = useStore((s) => s.intent);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!rebuttal.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await pushBackApi(counter, rebuttal.trim(), draft, intent || undefined);
      setResult(res);

      updateCounter(counter.id, {
        pushBack: {
          rebuttal: rebuttal.trim(),
          aiResponse: res.response,
          outcome: res.outcome,
        },
      });

      if (res.outcome === "concede") {
        setCounterStatus(counter.id, "dismissed");
      } else if (res.outcome === "refine" && res.refinedCounter) {
        updateCounter(counter.id, {
          body: res.refinedCounter.body,
          stance: res.refinedCounter.stance,
        });
      }
    } catch (err) {
      console.error("Push back error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  if (result) {
    return (
      <div className="counter-pushback">
        <div className={`outcome-badge ${result.outcome}`}>{result.outcome}</div>
        <div className="counter-ai-response">{result.response}</div>
        {result.outcome !== "concede" && (
          <div className="pushback-post-actions">
            <button
              className="counter-action"
              onClick={() => {
                setCounterStatus(counter.id, "adopted");
                onClose();
              }}
            >
              Adopt
            </button>
            <button
              className="counter-action"
              onClick={() => {
                setCounterStatus(counter.id, "dismissed");
                onClose();
              }}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="counter-pushback">
      <textarea
        ref={textareaRef}
        className="ring-input"
        value={rebuttal}
        onChange={(e) => setRebuttal(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Why is this counter wrong?"
        disabled={loading}
      />
      {error && (
        <p style={{ color: "#f87171", fontSize: "11px", marginTop: "6px" }}>{error}</p>
      )}
      <div className="ring-input-actions">
        <span className="ring-input-hint">⌘ + Enter to send</span>
        <button
          className="btn primary"
          onClick={handleSend}
          disabled={!rebuttal.trim() || loading}
        >
          {loading ? <Loader2 size={11} className="spin" /> : <Send size={11} />}
          {loading ? "Thinking…" : "Send"}
        </button>
      </div>
    </div>
  );
}
