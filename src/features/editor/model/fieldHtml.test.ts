// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fromEditorHtml, toEditorHtml } from "./fieldHtml";

describe("fromEditorHtml", () => {
  it.each([
    ["<p></p>", ""],
    ["<p>cat</p>", "cat"],
    ["<p>a</p><p>b</p>", "a<br>b"],
    ["<p>a<br>b</p>", "a<br>b"],
    ["<p><strong>a</strong></p><p></p><p>c</p>", "<strong>a</strong><br><br>c"],
    ['<p class="x">a</p>', "a"],
    ["<ul><li><p>a</p></li></ul>", "<ul><li><p>a</p></li></ul>"],
    ["<p>a</p><ul><li><p>b</p></li></ul>", "a<ul><li><p>b</p></li></ul>"],
  ])("%j → %j", (html, expected) => {
    expect(fromEditorHtml(html)).toBe(expected);
  });
});

const inline = (latex: string) => `<span data-math="inline" data-latex="${latex}"></span>`;
const display = (latex: string) => `<span data-math="display" data-latex="${latex}"></span>`;

describe("toEditorHtml", () => {
  it.each([
    ["no math", "no math"],
    ["a \\(x^2\\) b", `a ${inline("x^2")} b`],
    ["\\[\\frac{1}{2}\\]", display("\\frac{1}{2}")],
    ["\\(a\\)\\(b\\)", `${inline("a")}${inline("b")}`],
    ["<b>\\(x\\)</b> e \\[y\\]", `<b>${inline("x")}</b> e ${display("y")}`],
    ["\\(x = {{c1::\\frac{a}{b}}}\\)", inline("x = {{c1::\\frac{a}{b}}}")],
    ["aberto \\(x", "aberto \\(x"],
    ["\\(\\)", "\\(\\)"],
  ])("%j → %j", (html, expected) => {
    expect(toEditorHtml(html)).toBe(expected);
  });
});

describe("fromEditorHtml with formulas", () => {
  it("writes math nodes back with their delimiters", () => {
    expect(fromEditorHtml(`<p>a ${inline("x^2")} b</p><p>${display("y")}</p>`)).toBe(
      "a \\(x^2\\) b<br>\\[y\\]",
    );
  });

  it.each([
    "a \\(x^2\\) b",
    "<b>\\(x\\)</b> e \\[\\sqrt{2}\\]",
    "\\(a &lt; b &amp;&amp; c\\)",
    "\\(x = {{c1::\\frac{a}{b}::dica}}\\)",
    'texto <i>itálico</i> e \\("aspas"\\)',
  ])("round-trips %j through the editor format unchanged", (html) => {
    expect(fromEditorHtml(`<p>${toEditorHtml(html)}</p>`)).toBe(html);
  });
});
