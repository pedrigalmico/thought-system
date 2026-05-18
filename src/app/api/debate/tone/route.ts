import { NextResponse } from "next/server";
import { callGemini, parseJSON } from "@/lib/gemini";

// Lighter task — Gemini 2.0 Flash is fast and cheap enough
const MODEL = "gemini-2.0-flash";

const SYSTEM = `You are an editorial tone analyzer. Scan the draft for weak, vague, cliché, or "slop" language — the kind of filler that weakens persuasive writing.

Common slop patterns to flag: "I think", "in my opinion", "it goes without saying", "at the end of the day", "game-changer", "double-edged sword", "dive into", "unpack", "leverage", "synergy", "authentic", "journey", "navigate", "robust", "innovative", "revolutionary", "paradigm shift", "move the needle", "low-hanging fruit", "deep dive", "circle back", "touch base", "bandwidth", "ecosystem", "holistic", vague intensifiers ("very", "really", "incredibly", "absolutely"), and unnecessary hedging ("perhaps", "maybe", "sort of", "kind of").

For each flagged phrase:
- Identify the weak/cliché word or phrase
- Show the surrounding context (the sentence or fragment containing it)
- Suggest a stronger, more specific replacement in the same context

Respond in JSON format only, no markdown:
{ "scrubs": [{ "word": "<flagged word>", "before": "<original context>", "after": "<improved context>" }] }`;

export async function POST(req: Request) {
  try {
    const { draft, intent } = await req.json();
    let userMsg = `Draft title: ${draft.title}\n\nDraft body:\n${draft.body.join("\n\n")}`;
    if (intent) userMsg += `\n\n---\n\nAuthor's stated intent: "${intent}"\nFlag tone issues that would undermine this intent or weaken the post's ability to achieve it.`;

    const raw = await callGemini(MODEL, SYSTEM, userMsg);
    const data = parseJSON<{ scrubs: unknown[] }>(raw);

    return NextResponse.json(data);
  } catch (err) {
    console.error("Tone scrub error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
