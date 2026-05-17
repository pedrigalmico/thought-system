import type { ItemKind } from "@/lib/types";

const KIND_LABEL: Record<ItemKind, string> = {
  note: "Note",
  image: "Image",
  video: "Video",
  voice: "Voice",
  link: "Link",
  draft: "Draft",
};

export function CardHandle({ kind, meta }: { kind: ItemKind; meta?: string }) {
  return (
    <div className="card-handle">
      <span className="kind">
        <span className={`kind-dot ${kind}`} />
        <span className="kind-text">{KIND_LABEL[kind]}</span>
      </span>
      {meta && <span className="meta">{meta}</span>}
    </div>
  );
}
