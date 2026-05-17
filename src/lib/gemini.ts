import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

/**
 * Call a Gemini model with a system instruction + user message.
 * Returns the raw text response.
 */
export async function callGemini(
  model: string,
  system: string,
  userMessage: string,
  retries = 3,
): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: userMessage,
        config: {
          systemInstruction: system,
          temperature: 0.4,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from Gemini");
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("overloaded");
      if (isTransient && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Gemini unreachable after retries");
}

/**
 * Extract the first JSON object from a raw string response.
 */
export function parseJSON<T>(raw: string): T {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON object found in response: ${raw.slice(0, 200)}`);
  return JSON.parse(match[0]) as T;
}
