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
  FileVideo, Minus, Quote, Undo2, Redo2, PanelLeft,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { saveItem, fileToBase64, subscribeItems, loadDebateState, loadIntent } from "@/lib/db";
import { CounterHighlight } from "@/lib/counterHighlight";
import type { DraftItem, CanvasItem } from "@/lib/types";

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

  const draft = items.find((i) => i.kind === "draft") as DraftItem | undefined;
  const autoCreated = useRef(false);
  const [title, setTitle] = useState("");
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initializedRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
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
        updateItem(d2.id, pending as Partial<CanvasItem>);
        saveItem(topicId, { ...d2, ...pending }).catch(() => {});
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

  // Flush pending edits on unmount so changes survive tab switches
  useEffect(() => {
    return () => {
      clearTimeout(saveTimer.current);
      const d = draftRef.current;
      const pending = lastContentRef.current;
      if (d && pending) {
        updateItem(d.id, pending as Partial<CanvasItem>);
        saveItem(topicId, { ...d, ...pending }).catch(() => {});
        lastContentRef.current = null;
      }
    };
  }, [topicId, updateItem]);

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
      updateItem(d2.id, { title: val } as Partial<CanvasItem>);
      saveItem(topicId, { ...d2, title: val }).catch(() => {});
    }, 600);
  }, [topicId, updateItem]);

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
        <input
          className="refine-title"
          value={title}
          onChange={(e) => saveTitle(e.target.value)}
          placeholder="Post title..."
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

        <EditorContent editor={editor} />

        <div className="refine-stats">
          <span>{draft.wordCount} words</span>
          {draft.slopFlags > 0 && <span>{draft.slopFlags} slop flags</span>}
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
