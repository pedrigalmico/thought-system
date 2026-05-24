import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  query,
  orderBy,
  type Unsubscribe,
} from "firebase/firestore";
import { db, FIREBASE_ENABLED } from "./firebase";
import type { CanvasItem, Counter, Gate, RealityRow, ScrubRow } from "./types";

// ─── Topics ──────────────────────────────────────────────────────────────────

export interface TopicDoc {
  id: string;
  title: string;
  subtitle?: string;
  gate: Gate;
  itemCount: number;
  updatedAt: number;
  createdAt: number;
}

export async function getTopics(): Promise<TopicDoc[]> {
  if (!FIREBASE_ENABLED) return [];
  const snap = await getDocs(
    query(collection(db, "topics"), orderBy("updatedAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TopicDoc));
}

export function subscribeTopics(cb: (topics: TopicDoc[]) => void): Unsubscribe {
  if (!FIREBASE_ENABLED) return () => {};
  return onSnapshot(
    query(collection(db, "topics"), orderBy("updatedAt", "desc")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TopicDoc)))
  );
}

export async function createTopic(title: string): Promise<string> {
  if (!FIREBASE_ENABLED) return Math.random().toString(36).slice(2);
  const ref = doc(collection(db, "topics"));
  await setDoc(ref, {
    title,
    gate: "seed",
    itemCount: 0,
    updatedAt: Date.now(),
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function updateTopicGate(id: string, gate: Gate) {
  if (!FIREBASE_ENABLED) return;
  await updateDoc(doc(db, "topics", id), { gate, updatedAt: Date.now() });
}

export async function renameTopic(id: string, title: string) {
  if (!FIREBASE_ENABLED) return;
  await updateDoc(doc(db, "topics", id), { title, updatedAt: Date.now() });
}

export async function deleteTopic(id: string) {
  if (!FIREBASE_ENABLED) return;
  await deleteDoc(doc(db, "topics", id));
}

// ─── Canvas items ─────────────────────────────────────────────────────────────

export function subscribeItems(
  topicId: string,
  cb: (items: CanvasItem[]) => void
): Unsubscribe {
  if (!FIREBASE_ENABLED) return () => {};
  return onSnapshot(
    collection(db, "topics", topicId, "items"),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CanvasItem))
  ));
}

export async function saveItem(topicId: string, item: CanvasItem) {
  if (!FIREBASE_ENABLED) return;
  await setDoc(doc(db, "topics", topicId, "items", item.id), item);
  await updateDoc(doc(db, "topics", topicId), {
    updatedAt: Date.now(),
    itemCount: (await getDocs(collection(db, "topics", topicId, "items"))).size,
  });
}

export async function deleteVersionField(topicId: string, itemId: string) {
  if (!FIREBASE_ENABLED) return;
  await updateDoc(doc(db, "topics", topicId, "items", itemId), {
    versions: deleteField(),
  });
}

export async function deleteItem(topicId: string, itemId: string) {
  if (!FIREBASE_ENABLED) return;
  await deleteDoc(doc(db, "topics", topicId, "items", itemId));
}

// ─── Clusters ─────────────────────────────────────────────────────────────────

export function subscribeClusters(
  topicId: string,
  cb: (clusters: import("./types").Cluster[]) => void
): Unsubscribe {
  if (!FIREBASE_ENABLED) return () => {};
  return onSnapshot(
    collection(db, "topics", topicId, "clusters"),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as import("./types").Cluster)))
  );
}

export async function saveCluster(topicId: string, cluster: import("./types").Cluster) {
  if (!FIREBASE_ENABLED) return;
  await setDoc(doc(db, "topics", topicId, "clusters", cluster.id), cluster);
}

export async function deleteCluster(topicId: string, clusterId: string) {
  if (!FIREBASE_ENABLED) return;
  await deleteDoc(doc(db, "topics", topicId, "clusters", clusterId));
}

export async function syncSnapshot(
  topicId: string,
  items: CanvasItem[],
  clusters: import("./types").Cluster[]
) {
  if (!FIREBASE_ENABLED) return;
  const { writeBatch } = await import("firebase/firestore");
  const batch = writeBatch(db);

  const itemSnap = await getDocs(collection(db, "topics", topicId, "items"));
  const existingItemIds = new Set(itemSnap.docs.map((d) => d.id));
  const newItemIds = new Set(items.map((i) => i.id));
  for (const d of itemSnap.docs) {
    if (!newItemIds.has(d.id)) batch.delete(d.ref);
  }
  for (const item of items) {
    batch.set(doc(db, "topics", topicId, "items", item.id), item);
  }

  const clusterSnap = await getDocs(collection(db, "topics", topicId, "clusters"));
  const newClusterIds = new Set(clusters.map((c) => c.id));
  for (const d of clusterSnap.docs) {
    if (!newClusterIds.has(d.id)) batch.delete(d.ref);
  }
  for (const c of clusters) {
    batch.set(doc(db, "topics", topicId, "clusters", c.id), c);
  }

  await batch.commit();
}

// ─── Debate state ────────────────────────────────────────────────────────────

export interface DebateStateDoc {
  counters: Counter[];
  realityRows: RealityRow[];
  scrubRows: ScrubRow[];
  intent?: string;
  updatedAt: number;
}

export async function saveDebateState(
  topicId: string,
  state: { counters: Counter[]; realityRows: RealityRow[]; scrubRows: ScrubRow[] }
) {
  if (!FIREBASE_ENABLED) return;
  await setDoc(doc(db, "topics", topicId, "debate", "state"), {
    ...state,
    updatedAt: Date.now(),
  });
}

export async function loadDebateState(
  topicId: string
): Promise<DebateStateDoc | null> {
  if (!FIREBASE_ENABLED) return null;
  const { getDoc: getDocSnap } = await import("firebase/firestore");
  const snap = await getDocSnap(doc(db, "topics", topicId, "debate", "state"));
  if (!snap.exists()) return null;
  return snap.data() as DebateStateDoc;
}

// ─── Intent ──────────────────────────────────────────────────────────────────

export async function saveIntent(topicId: string, intent: string) {
  if (!FIREBASE_ENABLED) return;
  await setDoc(doc(db, "topics", topicId, "debate", "intent"), {
    intent,
    updatedAt: Date.now(),
  });
}

export async function loadIntent(topicId: string): Promise<string> {
  if (!FIREBASE_ENABLED) return "";
  const { getDoc: getDocSnap } = await import("firebase/firestore");
  const snap = await getDocSnap(doc(db, "topics", topicId, "debate", "intent"));
  if (!snap.exists()) return "";
  return (snap.data() as { intent: string }).intent ?? "";
}

// ─── Image → base64 (stored inline in Firestore, no Storage needed) ──────────

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
