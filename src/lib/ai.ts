"use client";

import type { Counter, DraftItem, RealityRow, ScrubRow, PushBackResult, VersionPlatform } from "./types";

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

export async function analyzeDraft(
  draft: DraftItem,
  intent?: string
): Promise<{ counters: Counter[]; claims: RealityRow[]; scrubs: ScrubRow[] }> {
  const data = await post<{
    counters: Counter[];
    claims: RealityRow[];
    scrubs: ScrubRow[];
  }>("/api/debate/analyze", { draft: draftToPayload(draft), intent });
  return {
    counters: data.counters || [],
    claims: data.claims || [],
    scrubs: data.scrubs || [],
  };
}

export async function generateCounters(draft: DraftItem, intent?: string): Promise<Counter[]> {
  const { counters } = await post<{ counters: Counter[] }>(
    "/api/debate/advocate",
    { draft: draftToPayload(draft), intent }
  );
  return counters;
}

export async function checkReality(draft: DraftItem, intent?: string): Promise<RealityRow[]> {
  const { claims } = await post<{ claims: RealityRow[] }>(
    "/api/debate/reality",
    { draft: draftToPayload(draft), intent }
  );
  return claims;
}

export async function scrubTone(draft: DraftItem, intent?: string): Promise<ScrubRow[]> {
  const { scrubs } = await post<{ scrubs: ScrubRow[] }>(
    "/api/debate/tone",
    { draft: draftToPayload(draft), intent }
  );
  return scrubs;
}

export async function pushBack(
  counter: Counter,
  rebuttal: string,
  draft: DraftItem,
  intent?: string
): Promise<PushBackResult> {
  return post<PushBackResult>("/api/debate/pushback", {
    counter: { id: counter.id, stance: counter.stance, body: counter.body },
    rebuttal,
    draft: draftToPayload(draft),
    intent,
  });
}

export async function condenseDraft(
  draft: DraftItem,
  platform: VersionPlatform,
  intent?: string,
  existingDraft?: { title: string; body: string[]; wordCount: number },
): Promise<{ title: string; body: string[]; wordCount: number }> {
  return post("/api/condense", {
    title: draft.title,
    body: draft.body,
    platform,
    intent,
    existingDraft,
  });
}

export async function synthesizeDraft(
  draft: DraftItem,
  adoptedCounters: Counter[],
  acceptedScrubs?: ScrubRow[],
  intent?: string
): Promise<{ title: string; body: string[]; wordCount: number; slopFlags: number }> {
  return post("/api/debate/synthesize", {
    draft: draftToPayload(draft),
    adoptedCounters: adoptedCounters.map((c) => ({
      stance: c.stance,
      body: c.body,
      revisionNote: c.revisionNote,
    })),
    acceptedScrubs,
    intent,
  });
}
