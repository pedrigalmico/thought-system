import { NextResponse } from "next/server";
import { callGemini, parseJSON } from "@/lib/gemini";

const MODEL = "gemini-2.5-flash";

const GENERATE_PROMPTS: Record<string, string> = {
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

const TIGHTEN_PROMPTS: Record<string, string> = {
  linkedin: `You are an editor. The author has written a draft for LinkedIn. Your job is to TIGHTEN it — not rewrite it.

This is the author's voice. Preserve their phrasing, personality, and tone. You are trimming fat, not replacing muscle.

Rules:
- Keep the author's exact words and phrases wherever possible
- Cut filler, redundancy, and throat-clearing — don't rephrase what's already clear
- If a sentence can be shorter without losing meaning, shorten it
- Fix grammar and punctuation only where clearly wrong
- Keep it under 200 words for LinkedIn readability
- If the full post contains a specific detail (a number, a name, a fact) that would strengthen a point the author is already making, you may add it briefly — but don't introduce new arguments
- Maintain short paragraphs (1-3 sentences) for mobile readability
- If the ending doesn't drive a click-through to the full post, strengthen it — but in the author's voice
- Do NOT add corporate jargon, buzzwords, or marketing polish the author didn't use
- Do NOT restructure the argument — follow the author's flow
- Output as HTML paragraphs, same format as the input

Respond in JSON only:
{ "title": "<keep or lightly edit the author's title, or empty string>", "body": ["<p>...</p>", ...], "wordCount": <number> }`,
};

export async function POST(req: Request) {
  try {
    const { title, body, platform, intent, existingDraft } = await req.json();

    const isTighten = existingDraft && existingDraft.body && existingDraft.body.length > 0 && existingDraft.wordCount > 0;
    const prompts = isTighten ? TIGHTEN_PROMPTS : GENERATE_PROMPTS;

    const system = prompts[platform];
    if (!system) {
      return NextResponse.json(
        { error: `Unknown platform: ${platform}` },
        { status: 400 },
      );
    }

    let userMsg: string;

    if (isTighten) {
      userMsg = `Author's LinkedIn draft:\n${existingDraft.body.join("\n\n")}`;
      if (existingDraft.title) {
        userMsg = `Draft title: ${existingDraft.title}\n\n${userMsg}`;
      }
      userMsg += `\n\n---\n\nFull blog post (for context and details you can pull from):\nTitle: ${title}\n\n${body.join("\n\n")}`;
    } else {
      userMsg = `Title: ${title}\n\nFull post:\n${body.join("\n\n")}`;
    }

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
