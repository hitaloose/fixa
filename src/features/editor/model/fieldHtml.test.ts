// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fromEditorHtml } from "./fieldHtml";

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
