// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeFieldHtml } from "./sanitize";

describe("sanitizeFieldHtml", () => {
  it.each([
    "<b>bold</b><i>it</i><u>under</u>",
    "<strong>s</strong><em>e</em><sub>2</sub><sup>3</sup>",
    "<div>line</div><br><ul><li>one</li></ul><ol><li>two</li></ol>",
    '<span style="color: red;">red</span>',
  ])("keeps allowed formatting: %s", (html) => {
    expect(sanitizeFieldHtml(html)).toBe(html);
  });

  it("keeps LaTeX delimiters and cloze markup as text", () => {
    const html = "\\( \\frac{3}{4} \\) e \\[ x^2 \\] {{c1::\\frac{a}{b}::dica}} [sound:a.mp3]";
    expect(sanitizeFieldHtml(html)).toBe(html);
  });

  it("removes script elements and their content", () => {
    expect(sanitizeFieldHtml("a<script>alert(1)</script>b")).toBe("ab");
  });

  it("removes event handler attributes", () => {
    expect(sanitizeFieldHtml('<img src="a.png" onerror="alert(1)">')).toBe('<img src="a.png">');
  });

  it("removes iframes, objects and embeds entirely", () => {
    expect(
      sanitizeFieldHtml('x<iframe src="https://e.com"></iframe><object></object><embed>y'),
    ).toBe("xy");
  });

  it("unwraps disallowed tags but keeps their text", () => {
    expect(sanitizeFieldHtml('<a href="https://e.com">link</a>')).toBe("link");
  });

  it.each([
    "https://evil.com/a.png",
    "http://evil.com/a.png",
    "//evil.com/a.png",
    "data:image/png;base64,AAAA",
    "javascript:alert(1)",
    "blob:https://x/1",
  ])("drops images whose src is not a local media file name: %s", (src) => {
    expect(sanitizeFieldHtml(`a<img src="${src}">b`)).toBe("ab");
  });

  it("keeps local audio with controls", () => {
    expect(sanitizeFieldHtml('<audio src="abc.mp3" controls=""></audio>')).toBe(
      '<audio src="abc.mp3" controls=""></audio>',
    );
  });

  it("drops audio with an external src", () => {
    expect(sanitizeFieldHtml('<audio src="https://e.com/a.mp3"></audio>')).toBe("");
  });

  it.each(["background: url(https://evil.com/t.png)", "width: expression(alert(1))"])(
    "removes style attributes that can load or run code: %s",
    (style) => {
      expect(sanitizeFieldHtml(`<span style="${style}">t</span>`)).toBe("<span>t</span>");
    },
  );
});
