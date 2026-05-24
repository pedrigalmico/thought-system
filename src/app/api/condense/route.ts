import { NextResponse } from "next/server";
import { callGemini, parseJSON } from "@/lib/gemini";

const MODEL = "gemini-2.5-flash";

const PROMPTS: Record<string, string> = {
  linkedin: `You are a content strategist. Given a full-length blog post, create a LinkedIn teaser that drives readers to click through and read the full piece on the author's website.

This is NOT a standalone summary — it's a hook. The reader should finish the teaser wanting more, not feeling like they already got the gist.

Rules:
- Open with a strong hook line (pattern interrupt, bold claim, or relatable pain point)
- Keep under 200 words — short enough to read in 30 seconds
- Use short paragraphs (1-2 sentences max)
- Reveal the most compelling insight or tension from the post, but leave the resolution for the full article
- End with a clear reason to click through (e.g. "I broke down the full pipeline →" or a provocative question that the full post answers)
- Preserve the author's voice and tone
- Do not add hashtags
- Do not summarize the full argument — tease it
- Output as HTML paragraphs, same format as the input

Respond in JSON only:
{ "title": "<short punchy title or empty string>", "body": ["<p>...</p>", ...], "wordCount": <number> }`,
};

export async function POST(req: Request) {
  try {
    const { title, body, platform, intent } = await req.json();

    const system = PROMPTS[platform];
    if (!system) {
      return NextResponse.json(
        { error: `Unknown platform: ${platform}` },
        { status: 400 },
      );
    }

    let userMsg = `Title: ${title}\n\nFull post:\n${body.join("\n\n")}`;

    if (intent) {
      userMsg += `\n\n---\n\nAuthor's intent: "${intent}"\nWhen deciding what to keep vs cut, prioritize content that serves this intent. Angle the hook and call-to-action to align with this goal.`;
    }
    const raw = await callGemini(MODEL, system, userMsg);
    const data = parseJSON<{ title: string; body: string[]; wordCount: number }>(raw);

    return NextResponse.json(data);
  } catch (err) {
    console.error("Condense error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
