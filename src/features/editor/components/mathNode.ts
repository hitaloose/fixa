import { Node } from "@tiptap/core";
import { renderCloze } from "../../../domain/templates";
import { t } from "../../../i18n";
import { renderLatex } from "../../../lib/math/render";

export interface MathAttrs {
  latex: string;
  display: boolean;
}

/** In the editor a cloze inside a formula shows its answer; the markup stays in the LaTeX. */
const forDisplay = (latex: string) => renderCloze(latex, 0, "back");

/**
 * A formula (docs/07-formulas.md): an atom holding LaTeX, shown with KaTeX. Written as
 * <span data-math data-latex>, which features/editor/model/fieldHtml turns into \(…\) / \[…\].
 */
export function createMathNode(onEdit: { current: (pos: number, attrs: MathAttrs) => void }) {
  return Node.create({
    name: "math",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,

    addAttributes: () => ({
      latex: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-latex") ?? "",
        renderHTML: () => ({}),
      },
      display: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-math") === "display",
        renderHTML: () => ({}),
      },
    }),

    parseHTML: () => [{ tag: "span[data-math]" }],

    renderHTML: ({ node }) => [
      "span",
      { "data-math": node.attrs.display ? "display" : "inline", "data-latex": node.attrs.latex },
    ],

    addNodeView:
      () =>
      ({ node, getPos }) => {
        const dom = document.createElement("span");
        dom.setAttribute("role", "button");
        dom.contentEditable = "false";
        let attrs = node.attrs as MathAttrs;
        const draw = () => {
          dom.setAttribute("aria-label", t.editor.editMath(attrs.latex));
          dom.className = attrs.display
            ? "math-node block cursor-pointer overflow-x-auto text-center"
            : "math-node cursor-pointer";
          void renderLatex(dom, forDisplay(attrs.latex), attrs.display);
        };
        draw();
        dom.addEventListener("click", () => {
          const pos = getPos();
          if (typeof pos === "number") onEdit.current(pos, attrs);
        });
        return {
          dom,
          update: (next) => {
            if (next.type.name !== "math") return false;
            attrs = next.attrs as MathAttrs;
            draw();
            return true;
          },
        };
      },
  });
}
