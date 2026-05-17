"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { subscribeTopics, createTopic, deleteTopic, renameTopic, type TopicDoc } from "@/lib/db";
import type { Gate } from "@/lib/types";

const GATE_COLORS: Record<Gate, string> = {
  seed: "",
  debate: "debate",
  refine: "refine",
  export: "export",
};

const GATE_LABEL: Record<Gate, string> = {
  seed: "Seed",
  debate: "Debate",
  refine: "Refine",
  export: "Export",
};

const MOCK_TOPICS: TopicDoc[] = [
  { id: "demo-1", title: "AI in 3D", subtitle: "Does generative 3D kill the art director, or free them?", gate: "debate", itemCount: 12, updatedAt: Date.now() - 3600000, createdAt: Date.now() - 86400000 },
  { id: "demo-2", title: "Strategic Design", subtitle: "Why every design team eventually becomes a cost center.", gate: "seed", itemCount: 8, updatedAt: Date.now() - 7200000, createdAt: Date.now() - 172800000 },
  { id: "demo-3", title: "AR/VR Trends", subtitle: "Spatial computing hype cycle — where are we actually?", gate: "refine", itemCount: 5, updatedAt: Date.now() - 172800000, createdAt: Date.now() - 259200000 },
];

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return `${Math.round(diff / 86400000)}d ago`;
}

export default function Home() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicDoc[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [firebaseOk, setFirebaseOk] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicDoc | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingTopic, setDeletingTopic] = useState<TopicDoc | null>(null);

  useEffect(() => {
    const hasFirebase = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== "your-project-id";
    if (!hasFirebase) {
      setTopics(MOCK_TOPICS);
      return;
    }
    setFirebaseOk(true);
    const unsub = subscribeTopics(setTopics);
    return unsub;
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      if (firebaseOk) {
        const id = await createTopic(newTitle.trim());
        router.push(`/topic/${id}?title=${encodeURIComponent(newTitle.trim())}`);
      } else {
        const id = `local-${Date.now()}`;
        router.push(`/topic/${id}?title=${encodeURIComponent(newTitle.trim())}`);
      }
    } finally {
      setCreating(false);
      setShowModal(false);
      setNewTitle("");
    }
  };

  const handleOpen = (t: TopicDoc) => {
    router.push(`/topic/${t.id}?title=${encodeURIComponent(t.title)}`);
  };

  const handleEditOpen = (t: TopicDoc) => {
    setEditingTopic(t);
    setEditTitle(t.title);
  };

  const handleEditSave = async () => {
    if (!editingTopic || !editTitle.trim()) return;
    const updated = { ...editingTopic, title: editTitle.trim() };
    if (firebaseOk) {
      await renameTopic(editingTopic.id, editTitle.trim()).catch(() => {});
    } else {
      setTopics((prev) => prev.map((t) => (t.id === editingTopic.id ? updated : t)));
    }
    setEditingTopic(null);
    setEditTitle("");
  };

  const handleDeleteConfirm = (t: TopicDoc) => {
    setDeletingTopic(t);
  };

  const handleDeleteExecute = async () => {
    if (!deletingTopic) return;
    if (firebaseOk) {
      await deleteTopic(deletingTopic.id).catch(() => {});
    } else {
      setTopics((prev) => prev.filter((t) => t.id !== deletingTopic.id));
    }
    setDeletingTopic(null);
  };

  return (
    <div className="home">
      {/* Topbar */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <span>The Director&apos;s Console</span>
        </div>
        <div className="topbar-spacer" />
        {!firebaseOk && (
          <span style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.06em" }}>
            ⚠ Firebase not configured · using demo data
          </span>
        )}
        <div className="topbar-actions">
          <button className="btn ghost" onClick={() => setShowModal(true)}>+ New Topic</button>
        </div>
      </header>

      {/* Body */}
      <div className="home-body">
        <div className="home-header">
          <span className="home-title">Your Thought-Streams · {topics.length} topics</span>
        </div>

        <div className="topic-grid">
          {/* New topic card */}
          <button className="topic-card topic-card-new" onClick={() => setShowModal(true)}>
            <span className="plus">+</span>
            <span className="label">New thought-stream</span>
          </button>

          {topics.map((t) => (
            <div key={t.id} className="topic-card-outer">
              <button className="topic-card" onClick={() => handleOpen(t)} style={{ textAlign: "left", width: "100%" }}>
                <div className="topic-card-header">
                  <span className={`topic-gate-badge ${GATE_COLORS[t.gate]}`}>
                    {GATE_LABEL[t.gate]}
                  </span>
                  <span className="topic-arrow">→</span>
                </div>
                <div className="topic-name">{t.title}</div>
                {t.subtitle && <div className="topic-subtitle">{t.subtitle}</div>}
                <div className="topic-meta">
                  <span>{t.itemCount} items</span>
                  <span>{timeAgo(t.updatedAt)}</span>
                </div>
              </button>
              <div className="topic-card-actions">
                <button
                  className="topic-action-btn"
                  title="Rename"
                  onClick={(e) => { e.stopPropagation(); handleEditOpen(t); }}
                >
                  ✎
                </button>
                <button
                  className="topic-action-btn topic-action-delete"
                  title="Delete"
                  onClick={(e) => { e.stopPropagation(); handleDeleteConfirm(t); }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <footer className="statusbar">
        <div className="item">
          <span className="pip coral" /> Home
        </div>
        <div className="spacer" />
        <div className="item">{firebaseOk ? "Firebase · live" : "Local · demo mode"}</div>
      </footer>

      {/* Rename topic modal */}
      {editingTopic && (
        <div className="modal-backdrop" onClick={() => setEditingTopic(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Rename thought-stream</div>
            <input
              autoFocus
              className="modal-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEditSave();
                if (e.key === "Escape") setEditingTopic(null);
              }}
            />
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setEditingTopic(null)}>Cancel</button>
              <button className="btn primary" onClick={handleEditSave} disabled={!editTitle.trim()}>
                Save →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingTopic && (
        <div className="modal-backdrop" onClick={() => setDeletingTopic(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Delete thought-stream</div>
            <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Delete &ldquo;{deletingTopic.title}&rdquo;? This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setDeletingTopic(null)}>Cancel</button>
              <button className="btn" onClick={handleDeleteExecute} style={{ borderColor: "#ef4444", color: "#ef4444" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New topic modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">New thought-stream</div>
            <input
              autoFocus
              className="modal-input"
              placeholder="What are you thinking about?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowModal(false);
              }}
            />
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn primary" onClick={handleCreate} disabled={creating || !newTitle.trim()}>
                {creating ? "Creating…" : "Create & open →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
