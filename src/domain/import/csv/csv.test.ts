import { describe, expect, it } from "vitest";
import { makeNoteType } from "../../../../tests/factories";
import { parseDelimited, planCsvNotes } from "./index";

describe("parseDelimited", () => {
  it("detects the separator and splits rows", () => {
    expect(parseDelimited("cat;gato\ndog;cão\n").rows).toEqual([
      ["cat", "gato"],
      ["dog", "cão"],
    ]);
    expect(parseDelimited("cat\tgato\ndog\tcão").separator).toBe("\t");
    expect(parseDelimited("a,b,c\n1,2,3").separator).toBe(",");
  });

  it("handles quoted cells with separators, quotes and line breaks", () => {
    const text = 'front,back\n"a, b","diz ""oi""\nnova linha"\n';
    expect(parseDelimited(text).rows).toEqual([
      ["front", "back"],
      ["a, b", 'diz "oi"\nnova linha'],
    ]);
  });

  it("reads Anki's # directives", () => {
    const text = [
      "#separator:Pipe",
      "#html:true",
      "#deck:Inglês::Verbos",
      "#notetype:Básico",
      "#tags:verbos importados",
      "#columns:Frente|Verso|Tags",
      "#tags column:3",
      "go|ir|irregular",
    ].join("\n");
    expect(parseDelimited(text)).toEqual({
      separator: "|",
      rows: [["go", "ir", "irregular"]],
      directives: {
        html: true,
        deck: "Inglês::Verbos",
        notetype: "Básico",
        tags: ["verbos", "importados"],
        columns: ["Frente", "Verso", "Tags"],
        tagsColumn: 2,
      },
    });
  });

  it.each([
    ["Comma", ","],
    ["Semicolon", ";"],
    ["Tab", "\t"],
    ["Space", " "],
    [":", ":"],
  ])("accepts #separator:%s", (name, separator) => {
    expect(parseDelimited(`#separator:${name}\nx`).separator).toBe(separator);
  });

  it("skips blank lines and handles Windows line endings and a BOM", () => {
    expect(parseDelimited("﻿a;b\r\n\r\nc;d\r\n").rows).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("planCsvNotes", () => {
  const noteType = makeNoteType(); // fields front ("Frente") and back ("Verso")

  it("maps columns to fields and tags, escaping plain text", () => {
    const notes = planCsvNotes({
      rows: [["a < b", "linha 1\nlinha 2", "x Y"]],
      mapping: ["front", "back", "tags"],
      noteType,
      html: false,
      extraTags: ["importado"],
    });
    expect(notes).toEqual([
      { fields: { front: "a &lt; b", back: "linha 1<br>linha 2" }, tags: ["x", "y", "importado"] },
    ]);
  });

  it("keeps HTML when the file says so, and ignores unmapped columns", () => {
    const notes = planCsvNotes({
      rows: [["<b>go</b>", "lixo", "ir"]],
      mapping: ["front", null, "back"],
      noteType,
      html: true,
      extraTags: [],
    });
    expect(notes).toEqual([{ fields: { front: "<b>go</b>", back: "ir" }, tags: [] }]);
  });

  it("fills missing cells with empty fields", () => {
    const notes = planCsvNotes({
      rows: [["só frente"]],
      mapping: ["front", "back"],
      noteType,
      html: false,
      extraTags: [],
    });
    expect(notes[0]?.fields).toEqual({ front: "só frente", back: "" });
  });
});
