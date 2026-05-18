import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const highlightKey = new PluginKey("counterHighlight");

function findTextPositions(
  doc: import("@tiptap/pm/model").Node,
  searchText: string
): { from: number; to: number }[] {
  if (!searchText) return [];

  const target = searchText.toLowerCase().trim();
  if (!target) return [];

  const results: { from: number; to: number }[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const lower = node.text.toLowerCase();
    let idx = lower.indexOf(target);
    while (idx !== -1) {
      results.push({ from: pos + idx, to: pos + idx + target.length });
      idx = lower.indexOf(target, idx + 1);
    }
  });

  return results;
}

export const CounterHighlight = Extension.create({
  name: "counterHighlight",

  addStorage() {
    return { quote: "" as string };
  },

  addProseMirrorPlugins() {
    const ext = this;

    return [
      new Plugin({
        key: highlightKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, oldSet) {
            const meta = tr.getMeta(highlightKey);
            if (meta !== undefined) {
              if (!meta.quote) return DecorationSet.empty;
              const positions = findTextPositions(tr.doc, meta.quote);
              const decorations = positions.map((p) =>
                Decoration.inline(p.from, p.to, {
                  class: "counter-highlight-inline",
                })
              );
              return DecorationSet.create(tr.doc, decorations);
            }
            if (tr.docChanged) {
              const mapped = oldSet.map(tr.mapping, tr.doc);
              const quote = ext.storage.quote;
              if (!quote) return DecorationSet.empty;
              const positions = findTextPositions(tr.doc, quote);
              const decorations = positions.map((p) =>
                Decoration.inline(p.from, p.to, {
                  class: "counter-highlight-inline",
                })
              );
              return DecorationSet.create(tr.doc, decorations);
            }
            return oldSet;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setCounterHighlight:
        (quote: string) =>
        ({ tr, dispatch }) => {
          this.storage.quote = quote;
          if (dispatch) {
            tr.setMeta(highlightKey, { quote });
            dispatch(tr);
          }
          return true;
        },
      clearCounterHighlight:
        () =>
        ({ tr, dispatch }) => {
          this.storage.quote = "";
          if (dispatch) {
            tr.setMeta(highlightKey, { quote: "" });
            dispatch(tr);
          }
          return true;
        },
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    counterHighlight: {
      setCounterHighlight: (quote: string) => ReturnType;
      clearCounterHighlight: () => ReturnType;
    };
  }
}
