import { NextResponse } from "next/server";
import { callGemini, parseJSON } from "@/lib/gemini";

const MODEL = "gemini-2.5-flash";

const SYSTEM = `You are a skilled editor. Rewrite the draft below, incorporating the adopted revision notes. Your goal is to strengthen the argument while preserving the author's voice, style, and structure.

Rules:
- Preserve the overall structure (number of paragraphs, flow)
- Strengthen specific claims that were challenged by the adopted revisions
- Add specificity where counters demanded it
- Apply accepted tone fixes if provided
- Do not add new arguments the author didn't make
- Keep approximately the same word count (±15%)
- Maintain the author's tone and personality throughout

Respond in JSON format only, no markdown:
{ "title": "<title>", "body": ["<paragraph1>", "<paragraph2>", ...], "wordCount": <number>, "slopFlags": <number> }`;

export async function POST(req: Request) {
  try {
    const { draft, adoptedCounters, acceptedScrubs } = await req.json();

    let userMsg = `Original draft title: ${draft.title}\n\nOriginal draft body:\n${draft.body.join("\n\n")}`;

    if (adoptedCounters?.length) {
      userMsg += "\n\n---\n\nAdopted revisions to incorporate:";
      for (const c of adoptedCounters) {
        userMsg += `\n- [${c.stance}] ${c.revisionNote || c.body}`;
      }
    }

    if (acceptedScrubs?.length) {
      userMsg += "\n\nAccepted tone fixes:";
      for (const s of acceptedScrubs) {
        userMsg += `\n- "${s.before}" → "${s.after}"`;
      }
    }

    const raw = await callGemini(MODEL, SYSTEM, userMsg);
    const data = parseJSON<{
      title: string;
      body: string[];
      wordCount: number;
      slopFlags: number;
    }>(raw);

    return NextResponse.json(data);
  } catch (err) {
    console.error("Synthesize error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
