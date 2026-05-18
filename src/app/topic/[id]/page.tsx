"use client";

import { use, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Statusbar } from "@/components/Statusbar";
import { Canvas } from "@/components/Canvas";
import { RefineEditor } from "@/components/RefineEditor";
import { SparringRing } from "@/components/SparringRing";
import { SourcesPanel } from "@/components/SourcesPanel";
import { ExportPanel } from "@/components/ExportPanel";
import { useStore } from "@/store/useStore";

export default function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const title = searchParams.get("title") ?? "Untitled";

  const setTopic = useStore((s) => s.setTopic);
  const panelOpen = useStore((s) => s.panelOpen);
  const sourcesOpen = useStore((s) => s.sourcesOpen);
  const gate = useStore((s) => s.gate);

  useEffect(() => {
    setTopic(id, title);
  }, [id, title, setTopic]);

  const stageClass = [
    "stage",
    panelOpen && "with-panel",
    sourcesOpen && gate === "refine" && "with-sources",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="app">
      <Topbar />
      <main className={stageClass} data-gate={gate}>
        {gate === "refine" && sourcesOpen && <SourcesPanel />}
        {gate === "export" ? (
          <ExportPanel />
        ) : gate === "refine" ? (
          <RefineEditor topicId={id} />
        ) : (
          <Canvas topicId={id} />
        )}
        {panelOpen && gate !== "export" && <SparringRing />}
      </main>
      <Statusbar />
    </div>
  );
}
