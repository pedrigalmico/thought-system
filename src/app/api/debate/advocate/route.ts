import { NextResponse } from "next/server";
import { callGemini, parseJSON } from "@/lib/gemini";

const MODEL = "gemini-2.5-flash";

const SYSTEM = `You are a rigorous intellectual sparring partner. Your job is to strengthen the writer's argument by challenging it from three different logical angles.

Read the draft below and generate exactly 3 counter-arguments. Each counter must use a DIFFERENT logical stance from this list: precedent, evidence, survivorship, definition, timing, inversion, pricing, specifics.

For each counter:
- Choose the stance that creates the strongest challenge to the draft's weakest points
- Write 2-3 sentences that directly challenge a specific claim or assumption in the draft
- Be specific — reference particular phrases or claims from the draft
- Be intellectually honest — don't create straw men
- Include a "quote" field: copy the EXACT short phrase or sentence (5–20 words) from the draft that your counter is targeting. This must be verbatim from the draft text.

Respond in JSON format only, no markdown:
{ "counters": [{ "id": "<8-char-random>", "stance": "<stance>", "body": "<challenge text>", "quote": "<verbatim excerpt from draft>" }] }`;

export async function POST(req: Request) {
  try {
    const { draft, intent } = await req.json();
    let userMsg = `Draft title: ${draft.title}\n\nDraft body:\n${draft.body.join("\n\n")}`;
    if (intent) userMsg += `\n\n---\n\nAuthor's stated intent for this post: "${intent}"\nChallenge the draft in ways that are relevant to whether it achieves this intent.`;

    const raw = await callGemini(MODEL, SYSTEM, userMsg);
    const data = parseJSON<{ counters: { id: string; stance: string; body: string }[] }>(raw);

    const counters = data.counters.map((c) => ({
      ...c,
      status: "open" as const,
    }));

    return NextResponse.json({ counters });
  } catch (err) {
    console.error("Advocate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
