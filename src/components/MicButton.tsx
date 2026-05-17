"use client";

import { useStore } from "@/store/useStore";

export function MicButton() {
  const recording = useStore((s) => s.recording);
  const toggle = useStore((s) => s.toggleRecording);
  return (
    <button
      className={`mic-btn ${recording ? "recording" : ""}`}
      onClick={toggle}
      aria-pressed={recording}
    >
      <span className="dot" />
      {recording ? "Recording…" : "Hold to capture a voice memo"}
      <span className="kbd">⌥ Space</span>
    </button>
  );
}
