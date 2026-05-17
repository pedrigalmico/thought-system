"use client";

import type { Counter, DraftItem, RealityRow, ScrubRow, PushBackResult } from "./types";

interface DraftPayload {
  title: string;
  body: string[];
}

function draftToPayload(draft: DraftItem): DraftPayload {
  return { title: draft.title, body: draft.body };
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function generateCounters(draft: DraftItem): Promise<Counter[]> {
  const { counters } = await post<{ counters: Counter[] }>(
    "/api/debate/advocate",
    { draft: draftToPayload(draft) }
  );
  return counters;
}

export async function checkReality(draft: DraftItem): Promise<RealityRow[]> {
  const { claims } = await post<{ claims: RealityRow[] }>(
    "/api/debate/reality",
    { draft: draftToPayload(draft) }
  );
  return claims;
}

export async function scrubTone(draft: DraftItem): Promise<ScrubRow[]> {
  const { scrubs } = await post<{ scrubs: ScrubRow[] }>(
    "/api/debate/tone",
    { draft: draftToPayload(draft) }
  );
  return scrubs;
}

export async function pushBack(
  counter: Counter,
  rebuttal: string,
  draft: DraftItem
): Promise<PushBackResult> {
  return post<PushBackResult>("/api/debate/pushback", {
    counter: { id: counter.id, stance: counter.stance, body: counter.body },
    rebuttal,
    draft: draftToPayload(draft),
  });
}

export async function synthesizeDraft(
  draft: DraftItem,
  adoptedCounters: Counter[],
  acceptedScrubs?: ScrubRow[]
): Promise<{ title: string; body: string[]; wordCount: number; slopFlags: number }> {
  return post("/api/debate/synthesize", {
    draft: draftToPayload(draft),
    adoptedCounters: adoptedCounters.map((c) => ({
      stance: c.stance,
      body: c.body,
      revisionNote: c.revisionNote,
    })),
    acceptedScrubs,
  });
}
