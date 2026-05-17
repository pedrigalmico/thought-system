import { NextResponse } from "next/server";
import { callGemini, parseJSON } from "@/lib/gemini";

const MODEL = "gemini-2.5-flash";

const SYSTEM = `You are engaged in an intellectual debate. You previously raised a counter-argument against the writer's draft. The writer has pushed back with a rebuttal.

Evaluate the rebuttal honestly. Respond with exactly ONE of these outcomes:
- "concede": The rebuttal effectively addresses your counter. Acknowledge this gracefully in 1-2 sentences.
- "hold": The rebuttal does not adequately address your counter. Explain why your challenge still stands in 2-3 sentences.
- "refine": The rebuttal partially addresses your counter. Narrow your challenge to a more specific point that the rebuttal didn't cover. Provide both a response and a refined counter.

Be intellectually honest. If the writer makes a good point, concede. Don't hold just to be difficult.

Respond in JSON format only, no markdown:
{ "outcome": "concede" | "hold" | "refine", "response": "<your 2-3 sentence response>", "refinedCounter": { "stance": "<stance>", "body": "<narrower challenge>" } | null }`;

export async function POST(req: Request) {
  try {
    const { counter, rebuttal, draft } = await req.json();
    const userMsg = `Draft context: "${draft.title}"
${draft.body.join("\n\n")}

---

Your original counter (stance: ${counter.stance}):
"${counter.body}"

---

The writer's rebuttal:
"${rebuttal}"`;

    const raw = await callGemini(MODEL, SYSTEM, userMsg);
    const data = parseJSON<{
      outcome: "concede" | "hold" | "refine";
      response: string;
      refinedCounter: { stance: string; body: string } | null;
    }>(raw);

    return NextResponse.json(data);
  } catch (err) {
    console.error("Pushback error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
