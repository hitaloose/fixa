// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { hasMath, loadKatex, renderLatex, renderMath } from "./render";

function element(html: string) {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
}

describe("hasMath", () => {
  it.each([
    ["\\(x\\)", true],
    ["a \\[x\\] b", true],
    ["no math (here) [really]", false],
    ["", false],
  ])("%j → %s", (html, expected) => {
    expect(hasMath(html)).toBe(expected);
  });
});

describe("renderMath", () => {
  it("does not load KaTeX when there is no formula", async () => {
    const load = vi.fn(loadKatex);
    await renderMath(element("<b>plain</b>"), load);
    expect(load).not.toHaveBeenCalled();
  });

  it("renders inline formulas, such as stacked fractions", async () => {
    const el = element("metade: \\(\\frac{1}{2}\\)");
    await renderMath(el);
    expect(el.querySelector(".katex .mfrac")).not.toBeNull();
    expect(el.querySelector(".katex-display")).toBeNull();
    expect(el.textContent).not.toContain("\\(");
  });

  it("renders display formulas as blocks", async () => {
    const el = element("\\[\\sqrt{2}\\]");
    await renderMath(el);
    expect(el.querySelector(".katex-display .sqrt")).not.toBeNull();
  });

  it("shows a broken formula as raw LaTeX instead of failing", async () => {
    const el = element("ok \\(\\frac{1}\\)");
    await renderMath(el);
    const error = el.querySelector(".katex-error");
    expect(error?.textContent).toBe("\\frac{1}");
    expect((error as HTMLElement).style.color).toBe("var(--color-danger)");
  });

  it("keeps the cloze class of hidden parts inside formulas", async () => {
    const el = element("\\(x = \\htmlClass{cloze}{[\\dots]}\\)");
    await renderMath(el);
    expect(el.querySelector(".katex .cloze")).not.toBeNull();
  });

  it("does not trust other HTML-producing commands", async () => {
    const el = element("\\(\\href{javascript:alert(1)}{x}\\)");
    await renderMath(el);
    expect(el.querySelector("a")).toBeNull();
  });
});

describe("renderLatex", () => {
  it("renders one formula inline or as a block", async () => {
    const inline = document.createElement("span");
    await renderLatex(inline, "\\frac{1}{2}", false);
    expect(inline.querySelector(".katex .mfrac")).not.toBeNull();
    expect(inline.querySelector(".katex-display")).toBeNull();
    const block = document.createElement("span");
    await renderLatex(block, "x", true);
    expect(block.querySelector(".katex-display")).not.toBeNull();
  });

  it("shows broken LaTeX as an error instead of throwing", async () => {
    const el = document.createElement("span");
    await renderLatex(el, "\\frac{1}", false);
    expect(el.querySelector(".katex-error")?.textContent).toBe("\\frac{1}");
  });
});
