export type Gate = "seed" | "debate" | "refine" | "export";
export type Tool = "select" | "lasso" | "note" | "image" | "link" | "voice";
export type ItemKind = "note" | "image" | "video" | "voice" | "link" | "draft";

export type Stance =
  | "precedent"
  | "evidence"
  | "survivorship"
  | "definition"
  | "timing"
  | "inversion"
  | "pricing"
  | "specifics";

export interface BaseItem {
  id: string;
  kind: ItemKind;
  x: number;
  y: number;
  w: number;
  h: number;
  cluster?: string;
  selected?: boolean;
}

export interface NoteItem extends BaseItem {
  kind: "note";
  body: string;
  tags?: string[];
  meta?: string;
}

export interface ImageItem extends BaseItem {
  kind: "image";
  src?: string;
  caption?: string;
  alt?: string;
}

export interface VideoItem extends BaseItem {
  kind: "video";
  thumb?: string;
  title: string;
  duration: string;
}

export interface VoiceItem extends BaseItem {
  kind: "voice";
  duration: string;
  transcript: string;
  played?: number;
}

export interface LinkItem extends BaseItem {
  kind: "link";
  host: string;
  title: string;
  snippet: string;
}

export interface DraftItem extends BaseItem {
  kind: "draft";
  pretitle?: string;
  title: string;
  body: string[];
  wordCount: number;
  slopFlags: number;
}

export type CanvasItem =
  | NoteItem
  | ImageItem
  | VideoItem
  | VoiceItem
  | LinkItem
  | DraftItem;

export interface Cluster {
  id: string;
  label: string;
  count: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Counter {
  id: string;
  stance: Stance;
  body: string;
  quote?: string;
  status: "open" | "adopted" | "dismissed";
  pushBack?: {
    rebuttal: string;
    aiResponse: string;
    outcome: "concede" | "hold" | "refine";
  };
  revisionNote?: string;
}

export interface PushBackResult {
  outcome: "concede" | "hold" | "refine";
  response: string;
  refinedCounter?: { stance: Stance; body: string };
}

export interface RealityRow {
  claim: string;
  verdict: "ok" | "warn" | "fail";
  source: string;
  sourceUrl?: string;
}

export interface ScrubRow {
  word: string;
  before: string;
  after: string;
  accepted?: boolean;
}
