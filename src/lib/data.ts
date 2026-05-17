import type { CanvasItem, Cluster, Counter, RealityRow, ScrubRow } from "./types";

export const SLOP_WORDS = [
  "unlock",
  "tapestry",
  "delve",
  "leverage",
  "utilize",
  "paradigm",
  "seamlessly",
  "navigate",
  "elevate",
  "transformative",
  "journey",
  "in today's landscape",
  "deep dive",
];

export const SAMPLE_CLUSTERS: Cluster[] = [
  { id: "c1", label: "The Hook", count: 3, x: 80, y: 80, w: 720, h: 280 },
  { id: "c2", label: "Counter-Evidence", count: 4, x: 880, y: 80, w: 700, h: 360 },
  { id: "c3", label: "Working Draft", count: 1, x: 380, y: 480, w: 540, h: 360 },
];

export const SAMPLE_ITEMS: CanvasItem[] = [
  {
    id: "n1",
    kind: "note",
    cluster: "c1",
    x: 110,
    y: 130,
    w: 320,
    h: 180,
    body: "What if the entire <em>AI in 3D</em> conversation is missing the point? Everyone is racing to generate assets. Nobody is asking what happens to the <em>director</em>.",
    tags: ["#thesis"],
    meta: "11:42",
  },
  {
    id: "i1",
    kind: "image",
    cluster: "c1",
    x: 460,
    y: 130,
    w: 320,
    h: 200,
    caption: "A scene that took 11 weeks. Now: 6 hours.",
  },
  {
    id: "n2",
    kind: "note",
    cluster: "c2",
    x: 910,
    y: 130,
    w: 320,
    h: 160,
    body: "Counter: every prior automation in film (CGI, color grading, NLE) <em>increased</em> director demand, not decreased it.",
    meta: "Pull quote",
  },
  {
    id: "v1",
    kind: "video",
    cluster: "c2",
    x: 1260,
    y: 130,
    w: 300,
    h: 200,
    title: "Sora 2 reveal — the 90-second shot",
    duration: "1:32",
  },
  {
    id: "l1",
    kind: "link",
    cluster: "c2",
    x: 910,
    y: 320,
    w: 320,
    h: 110,
    host: "stratechery.com",
    title: "The aggregator playbook arrives in production",
    snippet: "When the marginal cost of an asset drops to zero, the constraint shifts to taste, distribution, and trust.",
  },
  {
    id: "vo1",
    kind: "voice",
    cluster: "c2",
    x: 1260,
    y: 350,
    w: 300,
    h: 80,
    duration: "0:42",
    transcript: "The director's job was never the asset. It was the decision behind the asset.",
    played: 0.6,
  },
  {
    id: "d1",
    kind: "draft",
    cluster: "c3",
    x: 410,
    y: 530,
    w: 480,
    h: 300,
    pretitle: "Working Draft · 312 words",
    title: "AI Didn't Kill the Director. It Killed the Asset.",
    body: [
      "Every generation of production tooling has carried the same anxiety: <em>this one will replace us</em>. The Steadicam, the Avid, the LED wall — each one arrived with funeral notices for the people who used the old thing.",
      "None of them landed. The constraint kept moving up the stack. Crews shrank, but the role of <em>deciding</em> what should exist on screen got more valuable, not less.",
    ],
    wordCount: 312,
    slopFlags: 2,
  },
];

export const SAMPLE_COUNTERS: Counter[] = [
  {
    id: "co1",
    stance: "survivorship",
    body: "You said every prior automation made directors more valuable. Are you reading the survivors, or are you missing the directors who didn't make it through the NLE transition?",
    quote: "each one arrived with funeral notices for the people who used the old thing",
    status: "open",
  },
  {
    id: "co2",
    stance: "specifics",
    body: "Which director, in which year, on which film? A claim about \"the director\" needs one named example before it earns the right to generalize.",
    quote: "the role of deciding what should exist on screen got more valuable",
    status: "open",
  },
  {
    id: "co3",
    stance: "inversion",
    body: "Flip it. If AI doesn't kill the director, what would have to be true about distribution and audience attention by 2028? Spell out the world you're betting on.",
    quote: "The constraint kept moving up the stack",
    status: "open",
  },
];

export const SAMPLE_REALITY: RealityRow[] = [
  {
    verdict: "ok",
    claim: "Steadicam adoption (1976–1985) coincided with growth in feature director credits, not decline.",
    source: "Production Daily archive · 1985",
    sourceUrl: "#",
  },
  {
    verdict: "warn",
    claim: "\"Sora 2 cut a shot from 11 weeks to 6 hours\" — anecdotal, single source.",
    source: "Verify before publishing",
  },
];

export const SAMPLE_SCRUBS: ScrubRow[] = [
  { word: "unlock", before: "to unlock new creative directions", after: "to open new creative directions" },
  { word: "navigate", before: "directors will navigate this shift", after: "directors will work through this shift" },
];
