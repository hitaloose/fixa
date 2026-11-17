import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FieldEditor, type FieldEditorProps } from "./FieldEditor";

function Harness(
  props: Partial<FieldEditorProps> & { initial?: string; spy?: (v: string) => void },
) {
  const { initial = "", spy, ...rest } = props;
  const [value, setValue] = useState(initial);
  return (
    <>
      <FieldEditor
        label="Frente"
        value={value}
        onChange={(v) => {
          setValue(v);
          spy?.(v);
        }}
        storeMedia={async () => "x.png"}
        resolveMedia={async () => undefined}
        loadMathField={loadFakeMathField}
        {...rest}
      />
      <output data-testid="value">{value}</output>
      <button type="button" onClick={() => setValue("from outside")}>
        reset
      </button>
    </>
  );
}

/** Minimal stand-in for MathLive's <math-field> (the edge of this unit). */
class FakeMathField extends HTMLElement {
  value = "";
  connectedCallback() {
    this.tabIndex = 0; // the real element is focusable
  }
}
const loadFakeMathField = async () => {
  if (!customElements.get("math-field")) customElements.define("math-field", FakeMathField);
};

const box = () => screen.getByRole("textbox", { name: "Frente" });
const value = () => screen.getByTestId("value").textContent;

async function selectAll() {
  await userEvent.click(box());
  await userEvent.keyboard("{Control>}a{/Control}");
}

describe("FieldEditor", () => {
  it("is a multiline textbox named by the field, showing its content", async () => {
    render(<Harness initial="<b>cat</b>" />);
    expect(box()).toHaveAttribute("aria-multiline", "true");
    await waitFor(() => expect(box()).toHaveTextContent("cat"));
    expect(box().querySelector("strong")).not.toBeNull();
  });

  // Key-by-key typing is covered by e2e: jsdom has no real selection/layout for ProseMirror.
  it("reports entered text as field HTML", async () => {
    render(<Harness />);
    await userEvent.click(box());
    await userEvent.paste("cat");
    await waitFor(() => expect(value()).toBe("cat"));
  });

  it("applies bold, italic and underline to the selection", async () => {
    render(<Harness initial="cat" />);
    await selectAll();
    await userEvent.click(screen.getByRole("button", { name: "Negrito" }));
    await waitFor(() => expect(value()).toBe("<strong>cat</strong>"));
    expect(screen.getByRole("button", { name: "Negrito" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Itálico" }));
    await userEvent.click(screen.getByRole("button", { name: "Sublinhado" }));
    await waitFor(() => expect(value()).toBe("<strong><em><u>cat</u></em></strong>"));
  });

  it("wraps the selection in a new cloze deletion", async () => {
    render(<Harness initial="Brasília" nextCloze={3} />);
    await selectAll();
    await userEvent.click(screen.getByRole("button", { name: "Omissão" }));
    await waitFor(() => expect(value()).toBe("{{c3::Brasília}}"));
  });

  it("offers cloze deletion only when asked to", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "Omissão" })).not.toBeInTheDocument();
  });

  it("stores a picked image and inserts it by file name", async () => {
    const storeMedia = vi.fn(async () => "abc.png");
    render(<Harness storeMedia={storeMedia} />);
    const file = new File(["png"], "gato.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("Adicionar imagem"), file);
    await waitFor(() => expect(value()).toBe('<img src="abc.png">'));
    expect(storeMedia).toHaveBeenCalledWith(file);
  });

  it("stores a picked audio file and inserts a player", async () => {
    render(<Harness storeMedia={async () => "abc.mp3"} />);
    const file = new File(["mp3"], "som.mp3", { type: "audio/mpeg" });
    await userEvent.upload(screen.getByLabelText("Adicionar áudio"), file);
    await waitFor(() => expect(value()).toBe('<audio controls="" src="abc.mp3"></audio>'));
  });

  it("shows stored media through resolved URLs without changing the field HTML", async () => {
    render(<Harness initial='<img src="abc.png">' resolveMedia={async () => "blob:abc"} />);
    await waitFor(() => expect(within(box()).getByRole("img")).toHaveAttribute("src", "blob:abc"));
    expect(value()).toBe('<img src="abc.png">');
  });

  it("follows value changes made from outside", async () => {
    render(<Harness initial="cat" />);
    await userEvent.click(screen.getByRole("button", { name: "reset" }));
    await waitFor(() => expect(box()).toHaveTextContent("from outside"));
  });

  describe("formulas", () => {
    const formula = (latex: string) =>
      within(box()).findByRole("button", { name: `Editar fórmula: ${latex}` });

    async function editAsLatex(text: string) {
      const dialog = screen.getByRole("dialog", { name: "Fórmula" });
      await userEvent.click(within(dialog).getByRole("button", { name: "LaTeX" }));
      const tex = within(dialog).getByRole("textbox", { name: "LaTeX" });
      await userEvent.clear(tex);
      await userEvent.click(tex);
      await userEvent.paste(text);
      return dialog;
    }

    it("shows formulas rendered while keeping their LaTeX in the field", async () => {
      render(<Harness initial={"a \\(x^2\\) b"} />);
      await waitFor(async () =>
        expect((await formula("x^2")).querySelector(".katex")).not.toBeNull(),
      );
      await userEvent.click(box());
      await userEvent.paste("X");
      await waitFor(() => expect(value()).toBe("Xa \\(x^2\\) b"));
    });

    it("shows a cloze inside a formula without its markup", async () => {
      render(<Harness initial={"\\(x = {{c1::\\frac{a}{b}}}\\)"} />);
      const node = await formula("x = {{c1::\\frac{a}{b}}}");
      await waitFor(() => expect(node.querySelector(".mfrac")).not.toBeNull());
      expect(node.querySelector(".katex-error")).toBeNull();
    });

    it("edits a formula in its sheet", async () => {
      render(<Harness initial={"a \\(x^2\\) b"} />);
      await userEvent.click(await formula("x^2"));
      const dialog = await editAsLatex("y");
      await userEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
      await waitFor(() => expect(value()).toBe("a \\(y\\) b"));
    });

    it("removes a formula", async () => {
      render(<Harness initial={"a \\(x^2\\) b"} />);
      await userEvent.click(await formula("x^2"));
      await userEvent.click(screen.getByRole("button", { name: "Remover fórmula" }));
      await waitFor(() => expect(value()).toBe("a  b"));
    });

    it("inserts a new formula from the Σ button", async () => {
      render(<Harness />);
      await userEvent.click(screen.getByRole("button", { name: "Inserir fórmula" }));
      const dialog = await editAsLatex("\\frac{1}{2}");
      await userEvent.click(within(dialog).getByRole("button", { name: "Em destaque" }));
      await userEvent.click(within(dialog).getByRole("button", { name: "Inserir" }));
      await waitFor(() => expect(value()).toBe("\\[\\frac{1}{2}\\]"));
    });

    it("turns pasted text with delimiters into formulas", async () => {
      render(<Harness />);
      await userEvent.click(box());
      await userEvent.paste("área \\(\\pi r^2\\) & mais");
      await waitFor(() => expect(value()).toBe("área \\(\\pi r^2\\) &amp; mais"));
      expect(await formula("\\pi r^2")).toBeInTheDocument();
    });
  });
});
