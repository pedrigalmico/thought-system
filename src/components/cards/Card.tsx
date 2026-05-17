"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Play, Square, Mic } from "lucide-react";
import { CardHandle } from "./CardHandle";
import { useStore } from "@/store/useStore";
import type { CanvasItem, VoiceItem } from "@/lib/types";
import { saveItem } from "@/lib/db";

interface CardProps {
  item: CanvasItem;
  selected: boolean;
  topicId: string;
  onSelect: () => void;
  onDragStart: (e: React.PointerEvent) => void;
}

export function Card({ item, selected, topicId, onSelect, onDragStart }: CardProps) {
  const updateItem = useStore((s) => s.updateItem);
  const cardRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ sx: number; sy: number; ow: number; oh: number } | null>(null);

  useEffect(() => {
    if (!selected) return;
    const active = document.activeElement;
    if (cardRef.current && !cardRef.current.contains(active)) {
      cardRef.current.focus();
    }
  }, [selected]);

  const startImageResize = (e: React.PointerEvent) => {
    if (item.kind !== "image") return;
    e.stopPropagation();
    resizeRef.current = { sx: e.clientX, sy: e.clientY, ow: item.w, oh: item.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleImageResizeMove = (e: React.PointerEvent) => {
    if (!resizeRef.current || item.kind !== "image") return;
    const r = resizeRef.current;
    const dx = e.clientX - r.sx;
    const dy = e.clientY - r.sy;
    const aspectRatio = r.ow / r.oh;
    let newW = r.ow + dx;
    let newH = r.oh + dy;
    newH = newW / aspectRatio;
    if (newW >= 200) {
      updateItem(item.id, { w: newW, h: newH } as Partial<CanvasItem>);
    }
  };

  const handleImageResizeEnd = (e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const item_ = item;
    if (item_.kind === "image") {
      saveItem(topicId, item_).catch(() => {});
    }
    resizeRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const startNoteResize = (e: React.PointerEvent) => {
    if (item.kind !== "note") return;
    e.stopPropagation();
    resizeRef.current = { sx: e.clientX, sy: e.clientY, ow: item.w, oh: item.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleNoteResizeMove = (e: React.PointerEvent) => {
    if (!resizeRef.current || item.kind !== "note") return;
    const r = resizeRef.current;
    const dx = e.clientX - r.sx;
    const dy = e.clientY - r.sy;
    updateItem(item.id, {
      w: Math.max(200, r.ow + dx),
      h: Math.max(90, r.oh + dy),
    } as Partial<CanvasItem>);
  };

  const handleNoteResizeEnd = (e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    if (item.kind === "note") {
      saveItem(topicId, item).catch(() => {});
    }
    resizeRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const startDraftResize = (e: React.PointerEvent) => {
    if (item.kind !== "draft") return;
    e.stopPropagation();
    resizeRef.current = { sx: e.clientX, sy: e.clientY, ow: item.w, oh: item.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleDraftResizeMove = (e: React.PointerEvent) => {
    if (!resizeRef.current || item.kind !== "draft") return;
    const r = resizeRef.current;
    const dx = e.clientX - r.sx;
    const dy = e.clientY - r.sy;
    updateItem(item.id, {
      w: Math.max(300, r.ow + dx),
      h: Math.max(200, r.oh + dy),
    } as Partial<CanvasItem>);
  };

  const handleDraftResizeEnd = (e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    if (item.kind === "draft") {
      saveItem(topicId, item).catch(() => {});
    }
    resizeRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const className = [
    "card",
    item.kind === "image" && "img-card",
    item.kind === "video" && "video-card",
    item.kind === "voice" && "voice-card",
    item.kind === "link" && "link-card",
    item.kind === "draft" && "draft-card",
    selected && "selected",
  ]
    .filter(Boolean)
    .join(" ");

  const style: React.CSSProperties = {
    left: item.x,
    top: item.y,
    width: item.w,
    height: item.h,
  };

  return (
    <div
      ref={cardRef}
      className={className}
      style={style}
      tabIndex={-1}
      onPointerDown={onSelect}
      onPointerMove={item.kind === "image" ? handleImageResizeMove : item.kind === "note" ? handleNoteResizeMove : item.kind === "draft" ? handleDraftResizeMove : undefined}
      onPointerUp={item.kind === "image" ? handleImageResizeEnd : item.kind === "note" ? handleNoteResizeEnd : item.kind === "draft" ? handleDraftResizeEnd : undefined}
      onPointerCancel={item.kind === "image" ? handleImageResizeEnd : item.kind === "note" ? handleNoteResizeEnd : item.kind === "draft" ? handleDraftResizeEnd : undefined}
    >
      <div onPointerDown={onDragStart} style={{ cursor: "grab" }}>
        <CardHandle kind={item.kind} meta={"meta" in item ? item.meta : undefined} />
      </div>

      {item.kind === "note" && (
        <>
          <NoteBody item={item} selected={selected} topicId={topicId} updateItem={updateItem} />
          {selected && (
            <div
              onPointerDown={startNoteResize}
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 16,
                height: 16,
                cursor: "nwse-resize",
                background: "linear-gradient(135deg, transparent 50%, rgba(255,107,53,0.6) 50%)",
                borderRadius: "0 0 4px 0",
                zIndex: 10,
              }}
            />
          )}
        </>
      )}

      {item.kind === "image" && (
        <div className="card-body">
          <div className="img-frame">
            {item.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.src}
                alt={item.alt ?? ""}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                style={{ width: "100%", height: "100%", objectFit: "cover", userSelect: "none" }}
              />
            ) : (
              <div className="placeholder">{item.alt || "image · drop replaces"}</div>
            )}
            {item.caption && <div className="img-caption">{item.caption}</div>}
            {selected && (
              <div
                onPointerDown={startImageResize}
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 16,
                  height: 16,
                  cursor: "nwse-resize",
                  background: "linear-gradient(135deg, transparent 50%, rgba(255,107,53,0.8) 50%)",
                  borderRadius: "0 0 16px 0",
                }}
              />
            )}
          </div>
        </div>
      )}

      {item.kind === "video" && (
        <VideoBody item={item} />
      )}

      {item.kind === "voice" && (
        <VoiceBody item={item} updateItem={updateItem} />
      )}

      {item.kind === "link" && (
        <div className="card-body">
          <div className="link-host">
            <span className="fav" aria-hidden />
            {item.host}
          </div>
          <div className="link-title">{item.title}</div>
          <div className="link-snippet">{item.snippet}</div>
          <div
            className="link-arrow"
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              window.open(item.title.startsWith("http") ? item.title : `https://${item.host}`, "_blank", "noopener");
            }}
          >
            Open ↗
          </div>
        </div>
      )}

      {item.kind === "draft" && (
        <>
          <DraftBody item={item} selected={selected} topicId={topicId} updateItem={updateItem} />
          {selected && (
            <div
              onPointerDown={startDraftResize}
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 16,
                height: 16,
                cursor: "nwse-resize",
                background: "linear-gradient(135deg, transparent 50%, rgba(255,107,53,0.6) 50%)",
                borderRadius: "0 0 4px 0",
                zIndex: 10,
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ── Note: editable text area ──────────────────────────────────────────────── */

function NoteBody({
  item,
  selected,
  topicId,
  updateItem,
}: {
  item: Extract<CanvasItem, { kind: "note" }>;
  selected: boolean;
  topicId: string;
  updateItem: (id: string, patch: Partial<CanvasItem>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(!item.body);

  const autoSizeFromTextarea = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
    // card-body padding: 30px top + 14px bottom = 44px
    const newH = Math.max(90, el.scrollHeight + 44);
    updateItem(item.id, { h: newH } as Partial<CanvasItem>);
  }, [item.id, updateItem]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      autoSizeFromTextarea();
    }
  }, [editing, autoSizeFromTextarea]);

  // Auto-size from view mode after text renders
  useLayoutEffect(() => {
    if (editing) return;
    const el = bodyRef.current;
    if (!el) return;
    const newH = Math.max(90, el.offsetHeight);
    if (Math.abs(newH - item.h) > 2) {
      updateItem(item.id, { h: newH } as Partial<CanvasItem>);
    }
  }, [editing, item.body, item.tags, item.h, item.id, updateItem]);

  const commit = useCallback(() => {
    const val = ref.current?.value ?? "";
    updateItem(item.id, { body: val } as Partial<CanvasItem>);
    saveItem(topicId, { ...item, body: val }).catch(() => {});
    if (val) setEditing(false);
  }, [item, topicId, updateItem]);

  if (editing || (selected && !item.body)) {
    return (
      <div className="card-body" style={{ height: "auto" }}>
        <textarea
          ref={ref}
          className="note-textarea"
          defaultValue={item.body}
          placeholder="Type your note…"
          onBlur={commit}
          onChange={autoSizeFromTextarea}
          onKeyDown={(e) => {
            if (e.key === "Escape") commit();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  return (
    <div ref={bodyRef} className="card-body" style={{ height: "auto" }} onDoubleClick={() => setEditing(true)}>
      <div className="note-text">{item.body}</div>
      {item.tags && (
        <div className="note-meta">
          {item.tags.map((t) => (
            <span key={t} className="note-tag">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Draft: editable title + body ─────────────────────────────────────────── */

function DraftBody({
  item,
  selected,
  topicId,
  updateItem,
}: {
  item: Extract<CanvasItem, { kind: "draft" }>;
  selected: boolean;
  topicId: string;
  updateItem: (id: string, patch: Partial<CanvasItem>) => void;
}) {
  const isEmpty = !item.title && item.body.length === 0;
  const [editing, setEditing] = useState(isEmpty);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && titleRef.current) titleRef.current.focus();
  }, [editing]);

  const commit = useCallback(() => {
    const title = titleRef.current?.value ?? item.title;
    const rawBody = bodyRef.current?.value ?? "";
    const body = rawBody.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
    const wordCount = rawBody.trim() ? rawBody.trim().split(/\s+/).length : 0;
    const patch = { title, body, wordCount };
    updateItem(item.id, patch as Partial<CanvasItem>);
    saveItem(topicId, { ...item, ...patch }).catch(() => {});
    if (title || body.length > 0) setEditing(false);
  }, [item, topicId, updateItem]);

  if (editing || (selected && isEmpty)) {
    return (
      <div className="card-body" style={{ height: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          ref={titleRef}
          defaultValue={item.title}
          placeholder="Draft title…"
          style={{
            background: "transparent", border: "none", borderBottom: "1px solid rgba(255,107,53,0.3)",
            outline: "none", color: "var(--text)", fontWeight: 700, fontSize: 13,
            width: "100%", paddingBottom: 4,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === "Enter") bodyRef.current?.focus(); }}
        />
        <textarea
          ref={bodyRef}
          className="note-textarea"
          defaultValue={item.body.join("\n\n")}
          placeholder="Write your argument… (blank line = new paragraph)"
          style={{ minHeight: 180 }}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Escape") commit(); }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  return (
    <div className="card-body" onDoubleClick={() => setEditing(true)}>
      {item.pretitle && <div className="draft-pretitle">{item.pretitle}</div>}
      <div className="draft-title" style={{ opacity: item.title ? 1 : 0.35, fontStyle: item.title ? "normal" : "italic" }}>
        {item.title || "Untitled draft — double-click to write"}
      </div>
      <div className="draft-body">
        {item.body.map((p, i) => (
          <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
        ))}
      </div>
      <div className="draft-stats">
        <span>{item.wordCount} words</span>
        {item.slopFlags > 0 && <span>{item.slopFlags} slop flags</span>}
        <span>provenance · 6</span>
      </div>
    </div>
  );
}

/* ── Video: clickable play opens YouTube ───────────────────────────────────── */

function VideoBody({ item }: { item: Extract<CanvasItem, { kind: "video" }> }) {
  const [playing, setPlaying] = useState(false);
  const ytId = item.thumb?.match(/\/vi\/([A-Za-z0-9_-]{11})\//)?.[1];

  return (
    <div className="card-body">
      <div className="video-frame">
        {playing && ytId ? (
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
            allow="autoplay; encrypted-media"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", zIndex: 2 }}
          />
        ) : (
          <div
            className="video-thumb"
            style={item.thumb ? { backgroundImage: `url(${item.thumb})` } : undefined}
          >
            <button
              className="play-btn"
              aria-label="Play"
              onClick={(e) => {
                e.stopPropagation();
                if (ytId) {
                  setPlaying(true);
                } else if (item.title.startsWith("http")) {
                  window.open(item.title, "_blank", "noopener");
                }
              }}
            >
              <Play size={20} fill="currentColor" />
            </button>
          </div>
        )}
        {!playing && (
          <div className="video-meta">
            <span className="title">{item.title}</span>
            <span className="duration">{item.duration}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Voice: actual recording with MediaRecorder ────────────────────────────── */

function VoiceBody({
  item,
  updateItem,
}: {
  item: VoiceItem;
  updateItem: (id: string, patch: Partial<CanvasItem>) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playback, setPlayback] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  const hasAudio = !!audioUrl || !!item.transcript;

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunks.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };
      mediaRecorder.current = recorder;
      recorder.start();
      setRecording(true);
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 200);
    } catch {
      alert("Microphone access denied. Please allow microphone permissions.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.stop();
    }
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    const dur = formatTime(elapsed);
    updateItem(item.id, { duration: dur } as Partial<CanvasItem>);
  }, [elapsed, item.id, updateItem]);

  const togglePlayback = useCallback(() => {
    if (!audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.ontimeupdate = () => {
        const a = audioRef.current!;
        setPlayback(a.duration ? a.currentTime / a.duration : 0);
      };
      audioRef.current.onended = () => setPlayback(0);
    }
    if (audioRef.current.paused) {
      audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  const displayDuration = recording
    ? formatTime(elapsed)
    : item.duration !== "0:00"
    ? item.duration
    : audioUrl
    ? formatTime(elapsed)
    : "0:00";

  return (
    <div className="card-body">
      <div className="voice-wave">
        {Array.from({ length: 32 }).map((_, i) => {
          const h = recording
            ? 6 + Math.random() * 28
            : 6 + Math.abs(Math.sin(i * 1.7) * 28);
          return (
            <span
              key={i}
              className={`bar ${i / 32 < (audioUrl ? playback : item.played ?? 0) ? "played" : ""}`}
              style={{ height: h }}
            />
          );
        })}
      </div>
      <div className="voice-controls">
        {!hasAudio && !recording ? (
          <button
            className="voice-play"
            aria-label="Start recording"
            onClick={(e) => { e.stopPropagation(); startRecording(); }}
            style={{ borderColor: "var(--coral)", color: "var(--coral)" }}
          >
            <Mic size={11} />
          </button>
        ) : recording ? (
          <button
            className="voice-play recording-pulse"
            aria-label="Stop recording"
            onClick={(e) => { e.stopPropagation(); stopRecording(); }}
            style={{ borderColor: "#ef4444", color: "#ef4444" }}
          >
            <Square size={11} fill="currentColor" />
          </button>
        ) : (
          <button
            className="voice-play"
            aria-label="Play"
            onClick={(e) => { e.stopPropagation(); togglePlayback(); }}
          >
            <Play size={11} fill="currentColor" />
          </button>
        )}
        <span className="voice-time">{displayDuration}</span>
        {recording && <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>REC</span>}
      </div>
      {item.transcript && <div className="voice-transcript">{item.transcript}</div>}
    </div>
  );
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
