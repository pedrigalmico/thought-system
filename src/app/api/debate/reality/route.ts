import { NextResponse } from "next/server";
import { callGemini, parseJSON } from "@/lib/gemini";

const MODEL = "gemini-2.5-flash";

const SYSTEM = `You are a fact-checker. Scan the draft below for any factual claims, statistics, named references, historical assertions, or empirical statements.

For each claim found:
- Extract the exact claim text (keep it short, under 20 words)
- Assess its verifiability: "ok" (likely accurate / well-known), "warn" (questionable / needs citation), or "fail" (likely inaccurate / unsupported)
- Provide a source note explaining your assessment
- If you can identify a likely source URL, include it — otherwise use null

If the draft contains no factual claims, return an empty claims array.

Respond in JSON format only, no markdown:
{ "claims": [{ "claim": "<text>", "verdict": "ok" | "warn" | "fail", "source": "<note>", "sourceUrl": "<url or null>" }] }`;

export async function POST(req: Request) {
  try {
    const { draft } = await req.json();
    const userMsg = `Draft title: ${draft.title}\n\nDraft body:\n${draft.body.join("\n\n")}`;

    const raw = await callGemini(MODEL, SYSTEM, userMsg);
    const data = parseJSON<{ claims: unknown[] }>(raw);

    return NextResponse.json(data);
  } catch (err) {
    console.error("Reality check error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
