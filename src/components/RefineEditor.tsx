"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import {
  Bold, Italic, Code, Underline as UnderlineIcon, Strikethrough,
  List, Heading2, Heading3, Link as LinkIcon, Image as ImageIcon,
  FileVideo, Minus, Quote, Undo2, Redo2, PanelLeft, Plus, X, Loader2,
  Sparkles, RefreshCw,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { saveItem, fileToBase64, subscribeItems, loadDebateState, loadIntent, deleteVersionField } from "@/lib/db";
import { condenseDraft } from "@/lib/ai";
import { CounterHighlight } from "@/lib/counterHighlight";
import type { DraftItem, CanvasItem, VersionPlatform } from "@/lib/types";

function draftToHtml(draft: DraftItem): string {
  const parts: string[] = [];

  for (const p of draft.body) {
    if (/^<(h[1-6]|ul|ol|blockquote|figure|hr|p|div|img)\b/.test(p.trim())) {
      parts.push(p);
    } else {
      parts.push(`<p>${p}</p>`);
    }
  }

  return parts.join("");
}

function htmlToDraftBody(html: string): string[] {
  const div = document.createElement("div");
  div.innerHTML = html;
  const blocks: string[] = [];
  for (const child of Array.from(div.children)) {
    const outer = child.outerHTML.trim();
    if (outer) blocks.push(outer);
  }
  return blocks;
}

interface Props {
  topicId: string;
}

export function RefineEditor({ topicId }: Props) {
  const items = useStore((s) => s.items);
  const setItems = useStore((s) => s.setItems);
  const addItem = useStore((s) => s.addItem);
  const updateItem = useStore((s) => s.updateItem);
  const setCounters = useStore((s) => s.setCounters);
  const setRealityRows = useStore((s) => s.setRealityRows);
  const setScrubRows = useStore((s) => s.setScrubRows);
  const setDebateGenerated = useStore((s) => s.setDebateGenerated);
  const activeCounterId = useStore((s) => s.activeCounterId);
  const counters = useStore((s) => s.counters);
  const synthesizedDraft = useStore((s) => s.synthesizedDraft);
  const setIntent = useStore((s) => s.setIntent);
  const sourcesOpen = useStore((s) => s.sourcesOpen);
  const toggleSources = useStore((s) => s.toggleSources);
  const activeVersion = useStore((s) => s.activeVersion);
  const setActiveVersion = useStore((s) => s.setActiveVersion);
  const updateVersion = useStore((s) => s.updateVersion);
  const removeVersion = useStore((s) => s.removeVersion);
  const condensing = useStore((s) => s.condensing);
  const setCondensing = useStore((s) => s.setCondensing);
  const intent = useStore((s) => s.intent);

  const draft = items.find((i) => i.kind === "draft") as DraftItem | undefined;
  const autoCreated = useRef(false);
  const [title, setTitle] = useState("");
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initializedRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const activeVersionRef = useRef(activeVersion);
  activeVersionRef.current = activeVersion;
  const lastContentRef = useRef<{ body: string[]; wordCount: number } | null>(null);

  useEffect(() => {
    return subscribeItems(topicId, (newItems) => {
      setItems(newItems);
      setItemsLoaded(true);
    });
  }, [topicId, setItems]);

  // Auto-create draft if none exists (after initial load completes)
  useEffect(() => {
    if (!itemsLoaded || draft || autoCreated.current) return;
    autoCreated.current = true;
    const newDraft: DraftItem = {
      id: Math.random().toString(36).slice(2, 10),
      kind: "draft",
      x: 0, y: 0, w: 480, h: 300,
      title: "", body: [], wordCount: 0, slopFlags: 0,
    };
    addItem(newDraft);
    saveItem(topicId, newDraft).catch(() => {});
  }, [itemsLoaded, draft, topicId, addItem]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Youtube.configure({ width: 640, height: 360 }),
      Placeholder.configure({ placeholder: "Start writing your post..." }),
      Underline,
      CounterHighlight,
    ],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "refine-prosemirror",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const d = draftRef.current;
      if (!d) return;
      const html = ed.getHTML();
      const body = htmlToDraftBody(html);
      const text = ed.getText();
      const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
      lastContentRef.current = { body, wordCount };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const d2 = draftRef.current;
        if (!d2) return;
        const pending = lastContentRef.current;
        if (!pending) return;
        const ver = activeVersionRef.current;
        if (ver) {
          updateVersion(d2.id, ver, pending);
          const updatedVersions = {
            ...d2.versions,
            [ver]: { ...(d2.versions?.[ver] ?? { platform: ver, title: "", body: [], wordCount: 0 }), ...pending, updatedAt: Date.now() },
          };
          saveItem(topicId, { ...d2, versions: updatedVersions }).catch(() => {});
        } else {
          updateItem(d2.id, pending as Partial<CanvasItem>);
          saveItem(topicId, { ...d2, ...pending }).catch(() => {});
        }
        lastContentRef.current = null;
      }, 600);
    },
  });

  // Load draft content into editor when both are ready
  useEffect(() => {
    if (!editor || !draft || initializedRef.current) return;
    const html = draftToHtml(draft);
    editor.commands.setContent(html || "<p></p>");
    setTitle(draft.title);
    initializedRef.current = true;
  }, [editor, draft]);

  // When synthesis is applied (commitSynthesis updates the draft in store),
  // push the new content into the TipTap editor
  const prevSynthRef = useRef(synthesizedDraft);
  useEffect(() => {
    const wasSynth = prevSynthRef.current;
    prevSynthRef.current = synthesizedDraft;
    if (wasSynth && !synthesizedDraft && editor && draft) {
      const html = draftToHtml(draft);
      editor.commands.setContent(html || "<p></p>");
      setTitle(draft.title);
    }
  }, [synthesizedDraft, editor, draft]);

  // ── Version switching: swap editor content when activeVersion changes ──
  const prevVersionRef = useRef(activeVersion);
  useEffect(() => {
    if (!editor || !draft) return;
    const prev = prevVersionRef.current;
    prevVersionRef.current = activeVersion;
    if (prev === activeVersion) return;

    // Flush pending saves for the previous version
    clearTimeout(saveTimer.current);
    const d = draftRef.current;
    const pending = lastContentRef.current;
    if (d && pending) {
      if (prev) {
        updateVersion(d.id, prev, pending);
        const updatedVersions = {
          ...d.versions,
          [prev]: { ...(d.versions?.[prev] ?? { platform: prev, title: "", body: [], wordCount: 0 }), ...pending, updatedAt: Date.now() },
        };
        saveItem(topicId, { ...d, versions: updatedVersions }).catch(() => {});
      } else {
        updateItem(d.id, pending as Partial<CanvasItem>);
        saveItem(topicId, { ...d, ...pending }).catch(() => {});
      }
      lastContentRef.current = null;
    }

    // Swap content to the new version (or back to full post)
    if (activeVersion) {
      const ver = draft.versions?.[activeVersion];
      const html = ver ? draftToHtml({ ...draft, body: ver.body, title: ver.title }) : "<p></p>";
      editor.commands.setContent(html || "<p></p>");
      setTitle(ver?.title ?? "");
    } else {
      const html = draftToHtml(draft);
      editor.commands.setContent(html || "<p></p>");
      setTitle(draft.title);
    }
  }, [activeVersion, editor, draft, topicId, updateItem, updateVersion]);

  // Flush pending edits on unmount so changes survive tab switches
  useEffect(() => {
    return () => {
      clearTimeout(saveTimer.current);
      const d = draftRef.current;
      const pending = lastContentRef.current;
      if (d && pending) {
        const ver = activeVersionRef.current;
        if (ver) {
          updateVersion(d.id, ver, pending);
          const updatedVersions = {
            ...d.versions,
            [ver]: { ...(d.versions?.[ver] ?? { platform: ver, title: "", body: [], wordCount: 0 }), ...pending, updatedAt: Date.now() },
          };
          saveItem(topicId, { ...d, versions: updatedVersions }).catch(() => {});
        } else {
          updateItem(d.id, pending as Partial<CanvasItem>);
          saveItem(topicId, { ...d, ...pending }).catch(() => {});
        }
        lastContentRef.current = null;
      }
    };
  }, [topicId, updateItem, updateVersion]);

  // ── Restore saved debate + intent from Firebase on mount ──
  useEffect(() => {
    let cancelled = false;
    async function restoreSaved() {
      const [saved, savedIntent] = await Promise.all([
        loadDebateState(topicId),
        loadIntent(topicId),
      ]);
      if (cancelled) return;
      if (savedIntent) setIntent(savedIntent);
      if (saved && saved.counters.length > 0) {
        setCounters(saved.counters);
        setRealityRows(saved.realityRows);
        setScrubRows(saved.scrubRows);
        setDebateGenerated(true);
      }
    }
    restoreSaved();
    return () => { cancelled = true; };
  }, [topicId]);

  // ── Counter highlight: sync active counter quote → editor decorations ──
  useEffect(() => {
    if (!editor) return;
    const counter = counters.find((c) => c.id === activeCounterId);
    if (counter?.quote) {
      editor.commands.setCounterHighlight(counter.quote);
    } else {
      editor.commands.clearCounterHighlight();
    }
  }, [editor, activeCounterId, counters]);

  const saveTitle = useCallback((val: string) => {
    const d = draftRef.current;
    if (!d) return;
    setTitle(val);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const d2 = draftRef.current;
      if (!d2) return;
      const ver = activeVersionRef.current;
      if (ver) {
        updateVersion(d2.id, ver, { title: val });
        const updatedVersions = {
          ...d2.versions,
          [ver]: { ...(d2.versions?.[ver] ?? { platform: ver, title: "", body: [], wordCount: 0, updatedAt: 0 }), title: val, updatedAt: Date.now() },
        };
        saveItem(topicId, { ...d2, versions: updatedVersions }).catch(() => {});
      } else {
        updateItem(d2.id, { title: val } as Partial<CanvasItem>);
        saveItem(topicId, { ...d2, title: val }).catch(() => {});
      }
    }, 600);
  }, [topicId, updateItem, updateVersion]);

  const addImage = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const handleImageFile = useCallback(async (file: File) => {
    if (!editor) return;
    try {
      const src = await fileToBase64(file);
      editor.chain().focus().setImage({ src, alt: file.name }).run();
    } catch {
      alert("Image too large.");
    }
  }, [editor]);

  const addYoutube = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Paste a YouTube URL:");
    if (url?.trim()) {
      editor.commands.setYoutubeVideo({ src: url.trim() });
    }
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("URL:");
    if (url?.trim()) {
      editor.chain().focus().setLink({ href: url.trim() }).run();
    }
  }, [editor]);

  const handleCondense = useCallback(async (platform: VersionPlatform) => {
    const d = draftRef.current;
    if (!d || d.body.length === 0 || condensing) return;
    setCondensing(true);
    try {
      const result = await condenseDraft(d, platform, intent || undefined);
      const version = {
        platform,
        title: result.title,
        body: result.body,
        wordCount: result.wordCount,
        updatedAt: Date.now(),
      };
      updateVersion(d.id, platform, version);
      const updatedVersions = { ...d.versions, [platform]: version };
      await saveItem(topicId, { ...d, versions: updatedVersions });

      // Push content into the editor and set title
      if (editor) {
        const html = draftToHtml({ ...d, body: result.body, title: result.title });
        editor.commands.setContent(html || "<p></p>");
        setTitle(result.title);
      }
      setActiveVersion(platform);
    } catch (err) {
      console.error("Condense failed:", err);
    } finally {
      setCondensing(false);
    }
  }, [topicId, condensing, setCondensing, updateVersion, setActiveVersion, editor, intent]);

  const handleRemoveVersion = useCallback((platform: VersionPlatform) => {
    const d = draftRef.current;
    if (!d) return;
    removeVersion(d.id, platform);
    const { [platform]: _, ...rest } = d.versions ?? {};
    if (Object.keys(rest).length > 0) {
      saveItem(topicId, { ...d, versions: rest as DraftItem["versions"] }).catch(() => {});
    } else {
      deleteVersionField(topicId, d.id).catch(() => {});
    }
  }, [topicId, removeVersion]);

  const versionPlatforms = draft?.versions ? (Object.keys(draft.versions) as VersionPlatform[]) : [];

  if (!draft) {
    return (
      <div className="refine-wrap">
        <div className="refine-empty">
          <div className="panel-empty-text">Setting up your editor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="refine-wrap">
      <div className="refine-editor">
        <div className="version-strip">
          <button
            className={`version-tab${activeVersion === null ? " active" : ""}`}
            onClick={() => setActiveVersion(null)}
          >
            <span className="version-dot" />
            Full Post
          </button>
          {versionPlatforms.map((p) => (
            <button
              key={p}
              className={`version-tab${activeVersion === p ? " active" : ""}`}
              onClick={() => setActiveVersion(p)}
            >
              <span className="version-dot" />
              {p.charAt(0).toUpperCase() + p.slice(1)}
              <span
                className="version-close"
                onClick={(e) => { e.stopPropagation(); handleRemoveVersion(p); }}
              >
                <X size={10} />
              </span>
            </button>
          ))}
          <span className="version-sep" />
          {!draft.versions?.linkedin && (
            <button
              className="version-add"
              onClick={() => {
                updateVersion(draft.id, "linkedin", { platform: "linkedin", title: "", body: [], wordCount: 0 });
                saveItem(topicId, {
                  ...draft,
                  versions: { ...draft.versions, linkedin: { platform: "linkedin", title: "", body: [], wordCount: 0, updatedAt: Date.now() } },
                }).catch(() => {});
                setActiveVersion("linkedin");
              }}
              title="Add LinkedIn version"
            >
              <Plus size={12} />
            </button>
          )}
        </div>

        <input
          className="refine-title"
          value={title}
          onChange={(e) => saveTitle(e.target.value)}
          placeholder={activeVersion ? `${activeVersion.charAt(0).toUpperCase() + activeVersion.slice(1)} title...` : "Post title..."}
        />

        {editor && (
          <div className="refine-toolbar">
            <button onClick={toggleSources} className={sourcesOpen ? "active" : ""} title="Toggle sources"><PanelLeft size={15} /></button>
            <span className="refine-toolbar-sep" />
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive("heading", { level: 2 }) ? "active" : ""} title="Heading 2"><Heading2 size={15} /></button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive("heading", { level: 3 }) ? "active" : ""} title="Heading 3"><Heading3 size={15} /></button>
            <span className="refine-toolbar-sep" />
            <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive("bold") ? "active" : ""} title="Bold"><Bold size={15} /></button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive("italic") ? "active" : ""} title="Italic"><Italic size={15} /></button>
            <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive("underline") ? "active" : ""} title="Underline"><UnderlineIcon size={15} /></button>
            <button onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive("strike") ? "active" : ""} title="Strikethrough"><Strikethrough size={15} /></button>
            <button onClick={() => editor.chain().focus().toggleCode().run()} className={editor.isActive("code") ? "active" : ""} title="Inline code"><Code size={15} /></button>
            <span className="refine-toolbar-sep" />
            <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive("bulletList") ? "active" : ""} title="Bullet list"><List size={15} /></button>
            <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive("blockquote") ? "active" : ""} title="Pull quote"><Quote size={15} /></button>
            <button onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus size={15} /></button>
            <span className="refine-toolbar-sep" />
            <button onClick={addLink} className={editor.isActive("link") ? "active" : ""} title="Link"><LinkIcon size={15} /></button>
            <button onClick={addImage} title="Image"><ImageIcon size={15} /></button>
            <button onClick={addYoutube} title="YouTube embed"><FileVideo size={15} /></button>
            <span className="refine-toolbar-sep" />
            <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo"><Undo2 size={15} /></button>
            <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo"><Redo2 size={15} /></button>
          </div>
        )}

        {activeVersion && (!draft.versions?.[activeVersion] || (draft.versions[activeVersion].wordCount ?? 0) === 0) && (
          <div className="version-empty">
            <Sparkles size={20} />
            <div className="version-empty-title">Generate {activeVersion.charAt(0).toUpperCase() + activeVersion.slice(1)} Teaser</div>
            <div className="version-empty-desc">
              AI will condense your full post into a short, hook-driven teaser that drives readers to your website.
              {intent && <span className="version-empty-intent"> Guided by your intent.</span>}
            </div>
            <button
              className="version-generate-btn"
              onClick={() => handleCondense(activeVersion)}
              disabled={condensing || draft.body.length === 0}
            >
              {condensing ? <><Loader2 size={14} className="spin" /> Generating...</> : <><Sparkles size={14} /> Generate from full post</>}
            </button>
          </div>
        )}

        <EditorContent editor={editor} />

        <div className="refine-stats">
          {activeVersion ? (
            <>
              <span>{draft.versions?.[activeVersion]?.wordCount ?? 0} words</span>
              <span className="stats-ref">full post: {draft.wordCount}</span>
              {draft.versions?.[activeVersion] && (draft.versions[activeVersion].wordCount ?? 0) > 0 && (
                <button
                  className="stats-regen"
                  onClick={() => handleCondense(activeVersion)}
                  disabled={condensing}
                  title="Regenerate from full post"
                >
                  {condensing ? <Loader2 size={10} className="spin" /> : <RefreshCw size={10} />}
                  Regenerate
                </button>
              )}
            </>
          ) : (
            <>
              <span>{draft.wordCount} words</span>
              {draft.slopFlags > 0 && <span>{draft.slopFlags} slop flags</span>}
            </>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
