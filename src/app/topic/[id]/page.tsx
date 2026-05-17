"use client";

import { use, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Statusbar } from "@/components/Statusbar";
import { Canvas } from "@/components/Canvas";
import { FocusedDraft } from "@/components/FocusedDraft";
import { SparringRing } from "@/components/SparringRing";
import { ExportPanel } from "@/components/ExportPanel";
import { useStore } from "@/store/useStore";

export default function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const title = searchParams.get("title") ?? "Untitled";

  const setTopic = useStore((s) => s.setTopic);
  const panelOpen = useStore((s) => s.panelOpen);
  const gate = useStore((s) => s.gate);

  useEffect(() => {
    setTopic(id, title);
  }, [id, title, setTopic]);

  return (
    <div className="app">
      <Topbar />
      <main className={`stage ${panelOpen ? "with-panel" : ""}`} data-gate={gate}>
        {gate === "export" ? (
          <ExportPanel />
        ) : gate === "debate" ? (
          <FocusedDraft topicId={id} />
        ) : (
          <Canvas topicId={id} />
        )}
        {panelOpen && gate !== "export" && <SparringRing />}
      </main>
      <Statusbar />
    </div>
  );
}
