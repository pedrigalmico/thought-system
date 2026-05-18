import { NextResponse } from "next/server";
import { callGemini, parseJSON } from "@/lib/gemini";

const MODEL = "gemini-2.5-flash";

const SYSTEM = `You are an expert editorial sparring partner who performs three analyses on a draft in a single pass. Read the draft and return a JSON object with exactly three keys: "counters", "claims", and "scrubs".

─── SECTION 1: counters (Devil's Advocate) ───
Generate exactly 3 counter-arguments. Each counter must use a DIFFERENT logical stance from this list: precedent, evidence, survivorship, definition, timing, inversion, pricing, specifics.

For each counter:
- Choose the stance that creates the strongest challenge to the draft's weakest points
- Write 2-3 sentences that directly challenge a specific claim or assumption
- Be specific — reference particular phrases or claims from the draft
- Be intellectually honest — don't create straw men
- Include a "quote" field: copy the EXACT short phrase (5–20 words) from the draft that your counter targets. Must be verbatim.

─── SECTION 2: claims (Reality Check) ───
Scan for factual claims, statistics, named references, historical assertions, or empirical statements.

For each claim found:
- Extract the exact claim text (under 20 words)
- Assess verifiability: "ok" (likely accurate), "warn" (questionable / needs citation), or "fail" (likely inaccurate)
- Provide a source note explaining your assessment
- Include a sourceUrl if identifiable, otherwise null

If no factual claims exist, return an empty array.

─── SECTION 3: scrubs (Tone Scrubber) ───
Flag weak, vague, cliché, or "slop" language that weakens persuasive writing.

Common slop patterns: "I think", "in my opinion", "it goes without saying", "at the end of the day", "game-changer", "double-edged sword", "dive into", "unpack", "leverage", "synergy", "authentic", "journey", "navigate", "robust", "innovative", "revolutionary", "paradigm shift", "move the needle", "low-hanging fruit", "deep dive", "circle back", "touch base", "bandwidth", "ecosystem", "holistic", vague intensifiers ("very", "really", "incredibly", "absolutely"), unnecessary hedging ("perhaps", "maybe", "sort of", "kind of").

For each flagged phrase:
- Identify the weak/cliché word or phrase
- Show the surrounding context (sentence or fragment)
- Suggest a stronger, more specific replacement

If the draft is clean, return an empty array.

─── RESPONSE FORMAT ───
Respond in JSON only, no markdown:
{
  "counters": [{ "id": "<8-char-random>", "stance": "<stance>", "body": "<challenge text>", "quote": "<verbatim excerpt>" }],
  "claims": [{ "claim": "<text>", "verdict": "ok" | "warn" | "fail", "source": "<note>", "sourceUrl": "<url or null>" }],
  "scrubs": [{ "word": "<flagged word>", "before": "<original context>", "after": "<improved context>" }]
}`;

export async function POST(req: Request) {
  try {
    const { draft, intent } = await req.json();
    let userMsg = `Draft title: ${draft.title}\n\nDraft body:\n${draft.body.join("\n\n")}`;

    if (intent) {
      userMsg += `\n\n---\n\nAuthor's stated intent for this post: "${intent}"\n- Challenge the draft in ways relevant to whether it achieves this intent.\n- Prioritize fact-checking claims critical to this intent.\n- Flag tone issues that would undermine this intent.`;
    }

    const raw = await callGemini(MODEL, SYSTEM, userMsg);
    const data = parseJSON<{
      counters: { id: string; stance: string; body: string; quote?: string }[];
      claims: { claim: string; verdict: string; source: string; sourceUrl?: string }[];
      scrubs: { word: string; before: string; after: string }[];
    }>(raw);

    const counters = (data.counters || []).map((c) => ({
      ...c,
      status: "open" as const,
    }));

    return NextResponse.json({
      counters,
      claims: data.claims || [],
      scrubs: data.scrubs || [],
    });
  } catch (err) {
    console.error("Analyze error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
