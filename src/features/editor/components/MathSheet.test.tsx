import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MathSheet, type MathSheetProps } from "./MathSheet";

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

function open(props: Partial<MathSheetProps> = {}) {
  const onSave = vi.fn();
  const onRemove = vi.fn();
  render(
    <MathSheet
      open
      onOpenChange={() => {}}
      initial={{ latex: "", display: false }}
      isNew
      onSave={onSave}
      onRemove={onRemove}
      loadMathField={loadFakeMathField}
      {...props}
    />,
  );
  return { onSave, onRemove, dialog: screen.getByRole("dialog", { name: "Fórmula" }) };
}

const mathField = () => screen.findByLabelText("Fórmula", { selector: "math-field" });

describe("MathSheet", () => {
  it("edits visually with MathLive by default", async () => {
    const { onSave } = open({ initial: { latex: "x^2", display: false }, isNew: false });
    const field = (await mathField()) as FakeMathField;
    expect(field.value).toBe("x^2");
    expect(field).toHaveFocus();
    expect(screen.getByRole("button", { name: "Visual" })).toHaveAttribute("aria-pressed", "true");
    field.value = "\\frac{3}{4}";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onSave).toHaveBeenCalledWith({ latex: "\\frac{3}{4}", display: false });
  });

  it("lets the user type LaTeX, with a live preview, and insert it as a block", async () => {
    const { onSave } = open();
    await userEvent.click(screen.getByRole("button", { name: "LaTeX" }));
    await userEvent.click(screen.getByRole("textbox", { name: "LaTeX" }));
    await userEvent.paste("\\frac{1}{2}");
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Pré-visualização da fórmula" }).querySelector(".mfrac"),
      ).not.toBeNull(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Em destaque" }));
    expect(screen.getByRole("button", { name: "Em destaque" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Inserir" }));
    expect(onSave).toHaveBeenCalledWith({ latex: "\\frac{1}{2}", display: true });
  });

  it("keeps the formula when switching between visual and LaTeX", async () => {
    open({ initial: { latex: "a+b", display: false } });
    await mathField();
    await userEvent.click(screen.getByRole("button", { name: "LaTeX" }));
    expect(screen.getByRole("textbox", { name: "LaTeX" })).toHaveValue("a+b");
    await userEvent.clear(screen.getByRole("textbox", { name: "LaTeX" }));
    await userEvent.paste("c");
    await userEvent.click(screen.getByRole("button", { name: "Visual" }));
    expect(((await mathField()) as FakeMathField).value).toBe("c");
  });

  it("cannot insert an empty formula", () => {
    open();
    expect(screen.getByRole("button", { name: "Inserir" })).toBeDisabled();
  });

  it("removes an existing formula", async () => {
    const { onRemove } = open({ initial: { latex: "x", display: true }, isNew: false });
    expect(screen.getByRole("button", { name: "Em destaque" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Remover fórmula" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("makes room for MathLive's virtual keyboard while it is shown", async () => {
    const keyboard = Object.assign(new EventTarget(), {
      visible: true,
      boundingRect: new DOMRect(0, 500, 390, 300),
    });
    Object.defineProperty(window, "mathVirtualKeyboard", { value: keyboard, configurable: true });
    try {
      open();
      await mathField();
      const space = screen.getByTestId("keyboard-space");
      expect(space).toHaveStyle({ height: "300px" });
      keyboard.visible = false;
      act(() => {
        keyboard.dispatchEvent(new Event("geometrychange"));
      });
      expect(space).toHaveStyle({ height: "0px" });
    } finally {
      Reflect.deleteProperty(window, "mathVirtualKeyboard");
    }
  });

  it("offers no removal for a new formula", () => {
    open();
    expect(screen.queryByRole("button", { name: "Remover fórmula" })).not.toBeInTheDocument();
  });
});
