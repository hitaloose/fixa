import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { clozeNumbers, renderCloze } from "./cloze";

const hidden = '<span class="cloze">[…]</span>';
const shown = (s: string) => `<span class="cloze">${s}</span>`;

describe("clozeNumbers", () => {
  it("lists the distinct cloze numbers in ascending order", () => {
    expect(clozeNumbers("{{c3::a}} {{c1::b}} {{c3::c}}")).toEqual([1, 3]);
  });

  it("finds clozes nested inside other clozes", () => {
    expect(clozeNumbers("{{c1::a {{c2::b}}}}")).toEqual([1, 2]);
  });

  it("ignores text that is not a cloze", () => {
    expect(clozeNumbers("{{c0::a}} {{c::b}} {{cx::c}} {c1::d} plain")).toEqual([]);
  });

  it("supports multi-digit numbers", () => {
    expect(clozeNumbers("{{c12::a}}")).toEqual([12]);
  });
});

describe("renderCloze — text", () => {
  const text = "{{c1::Brasília}} é a capital do {{c2::Brasil}}";

  it("hides the active cloze on the front and shows the others as plain text", () => {
    expect(renderCloze(text, 1, "front")).toBe(`${hidden} é a capital do Brasil`);
    expect(renderCloze(text, 2, "front")).toBe(`Brasília é a capital do ${hidden}`);
  });

  it("highlights the active cloze on the back", () => {
    expect(renderCloze(text, 1, "back")).toBe(`${shown("Brasília")} é a capital do Brasil`);
  });

  it("shows the hint in place of the ellipsis", () => {
    expect(renderCloze("{{c1::Brasília::cidade}}", 1, "front")).toBe(
      '<span class="cloze">[cidade]</span>',
    );
    expect(renderCloze("{{c1::Brasília::cidade}}", 1, "back")).toBe(shown("Brasília"));
    expect(renderCloze("{{c1::Brasília::cidade}}", 2, "front")).toBe("Brasília");
  });

  it("hides every occurrence of the active number", () => {
    expect(renderCloze("{{c1::a}} e {{c1::b}}", 1, "front")).toBe(`${hidden} e ${hidden}`);
  });

  it("handles nested clozes", () => {
    const nested = "{{c1::a {{c2::b}}}}";
    expect(renderCloze(nested, 1, "front")).toBe(hidden);
    expect(renderCloze(nested, 1, "back")).toBe(shown("a b"));
    expect(renderCloze(nested, 2, "front")).toBe(`a ${hidden}`);
    expect(renderCloze(nested, 2, "back")).toBe(`a ${shown("b")}`);
  });

  it("takes the hint from the outer cloze, not from a nested one", () => {
    const nested = "{{c1::a {{c2::b::h}}::outer}}";
    expect(renderCloze(nested, 1, "front")).toBe('<span class="cloze">[outer]</span>');
    expect(renderCloze(nested, 2, "front")).toBe('a <span class="cloze">[h]</span>');
  });

  it("does not split the hint on :: inside braces", () => {
    expect(renderCloze("{{c1::{a::b}}}", 1, "back")).toBe(shown("{a::b}"));
  });

  it("leaves an unclosed cloze untouched", () => {
    expect(renderCloze("{{c1::abc", 1, "front")).toBe("{{c1::abc");
  });

  it("falls back to the first }} when braces inside a cloze are unbalanced", () => {
    expect(renderCloze("{{c1::a{b}}!", 1, "back")).toBe(`${shown("a{b")}!`);
  });

  it("can wrap a whole formula", () => {
    expect(renderCloze("{{c1::\\(x^2\\)}}", 1, "front")).toBe(hidden);
    expect(renderCloze("{{c1::\\(x^2\\)}}", 1, "back")).toBe(shown("\\(x^2\\)"));
  });

  it("keeps text without clozes unchanged", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes("{{c")),
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom("front" as const, "back" as const),
        (s, n, side) => renderCloze(s, n, side) === s,
      ),
    );
  });
});

describe("renderCloze — inside a formula", () => {
  it("hides the active cloze with LaTeX instead of HTML", () => {
    const tex = "\\(x = {{c1::\\frac{a}{b}}}\\)";
    expect(renderCloze(tex, 1, "front")).toBe("\\(x = \\htmlClass{cloze}{[\\dots]}\\)");
    expect(renderCloze(tex, 1, "back")).toBe("\\(x = \\htmlClass{cloze}{\\frac{a}{b}}\\)");
    expect(renderCloze(tex, 2, "front")).toBe("\\(x = \\frac{a}{b}\\)");
  });

  it("works in display formulas", () => {
    expect(renderCloze("\\[{{c1::\\sqrt{2}}}\\]", 1, "front")).toBe(
      "\\[\\htmlClass{cloze}{[\\dots]}\\]",
    );
  });

  it("writes the hint as escaped LaTeX text", () => {
    expect(renderCloze("\\({{c1::\\pi::raz{ã}o_1 & 50%}}\\)", 1, "front")).toBe(
      "\\(\\htmlClass{cloze}{[\\text{raz\\{ã\\}o\\_1 \\& 50\\%}]}\\)",
    );
  });

  it("treats text after a closed formula as text again", () => {
    expect(renderCloze("\\(a\\) {{c1::b}}", 1, "front")).toBe(`\\(a\\) ${hidden}`);
  });
});
