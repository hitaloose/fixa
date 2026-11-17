import { describe, expect, it } from "vitest";
import { makeNote, makeNoteType } from "../../../tests/factories";
import type { Note, NoteType } from "../model";
import { generateCards, isFieldEmpty, renderCard } from "./index";

const basic = (front: string, back: string) =>
  makeNoteType({
    templates: [{ id: "t1", name: "Cartão 1", front, back }],
  });
const noteOf = (fields: Note["fields"]) => makeNote({ fields });

const reversed = makeNoteType({
  templates: [
    { id: "t1", name: "Cartão 1", front: "{{Frente}}", back: "{{FrontSide}}<hr>{{Verso}}" },
    { id: "t2", name: "Cartão 2", front: "{{Verso}}", back: "{{FrontSide}}<hr>{{Frente}}" },
  ],
});

const cloze: NoteType = makeNoteType({
  name: "Omissão",
  kind: "cloze",
  fields: [
    { id: "text", name: "Texto", sticky: false, rtl: false },
    { id: "extra", name: "Extra", sticky: false, rtl: false },
  ],
  templates: [
    { id: "c", name: "Omissão", front: "{{cloze:Texto}}", back: "{{cloze:Texto}}<br>{{Extra}}" },
  ],
});

describe("isFieldEmpty", () => {
  it.each([
    "",
    "   ",
    "<br>",
    "<div><br></div>",
    '<div class="x"><br /></div>',
    "<p> </p>",
    "&nbsp;",
    "​",
  ])("%j is empty", (html) => {
    expect(isFieldEmpty(html)).toBe(true);
  });

  it.each(["a", "<b>a</b>", '<img src="a.png">', "\\(x\\)"])("%j is not empty", (html) => {
    expect(isFieldEmpty(html)).toBe(false);
  });
});

describe("renderCard — fields", () => {
  it("replaces field references by name", () => {
    const note = noteOf({ front: "<b>cat</b>", back: "gato" });
    expect(renderCard({ noteType: makeNoteType(), note, templateOrd: 0 })).toEqual({
      front: "<b>cat</b>",
      back: "<b>cat</b><hr id=answer>gato",
    });
  });

  it("tolerates spaces inside the braces", () => {
    const nt = basic("{{ Frente }}", "{{  Verso}}");
    expect(
      renderCard({ noteType: nt, note: noteOf({ front: "a", back: "b" }), templateOrd: 0 }),
    ).toEqual({ front: "a", back: "b" });
  });

  it("renders unknown fields and missing values as empty", () => {
    const nt = basic("[{{Nope}}]", "[{{Verso}}]");
    expect(renderCard({ noteType: nt, note: noteOf({ front: "a" }), templateOrd: 0 })).toEqual({
      front: "[]",
      back: "[]",
    });
  });

  it("strips HTML with the text: filter", () => {
    const nt = basic("{{text:Frente}}", "");
    const note = noteOf({ front: "<b>a</b><br>b &amp; c", back: "" });
    expect(renderCard({ noteType: nt, note, templateOrd: 0 }).front).toBe("ab &amp; c");
  });

  it("trims tag, section and filter names", () => {
    const nt = basic("{{ #Verso }}[{{ text : Frente }}]{{/Verso}}{{# Frente}}!{{/Frente}}", "");
    const note = noteOf({ front: "<b>a</b>", back: "b" });
    expect(renderCard({ noteType: nt, note, templateOrd: 0 }).front).toBe("[a]!");
  });

  it("applies filters to FrontSide and leaves it empty on the front", () => {
    const nt = basic("<b>{{Frente}}</b>[{{FrontSide}}]", "{{text:FrontSide}}");
    const note = noteOf({ front: "a", back: "" });
    expect(renderCard({ noteType: nt, note, templateOrd: 0 })).toEqual({
      front: "<b>a</b>[]",
      back: "a[]",
    });
  });

  it("leaves clozes alone in a standard note type", () => {
    const nt = basic("{{cloze:Frente}}", "");
    const note = noteOf({ front: "{{c1::a}}", back: "" });
    expect(renderCard({ noteType: nt, note, templateOrd: 0 }).front).toBe("{{c1::a}}");
  });

  it("ignores filters it does not know", () => {
    const nt = basic("{{hint:Frente}}", "{{type:Verso}}");
    const note = noteOf({ front: "a", back: "b" });
    expect(renderCard({ noteType: nt, note, templateOrd: 0 })).toEqual({ front: "a", back: "b" });
  });

  it("keeps literal braces that are not tags", () => {
    const nt = basic("{a} {{Frente}} }}", "{{");
    const note = noteOf({ front: "x", back: "" });
    expect(renderCard({ noteType: nt, note, templateOrd: 0 })).toEqual({
      front: "{a} x }}",
      back: "{{",
    });
  });

  it("does not interpret template syntax coming from field content", () => {
    const note = noteOf({ front: "{{Verso}}", back: "secret" });
    expect(renderCard({ noteType: basic("{{Frente}}", ""), note, templateOrd: 0 }).front).toBe(
      "{{Verso}}",
    );
  });

  it("renders the matching template of a multi-template note type", () => {
    const note = noteOf({ front: "cat", back: "gato" });
    expect(renderCard({ noteType: reversed, note, templateOrd: 1 })).toEqual({
      front: "gato",
      back: "gato<hr>cat",
    });
  });

  it("rejects a template that does not exist", () => {
    expect(() => renderCard({ noteType: reversed, note: noteOf({}), templateOrd: 2 })).toThrow(
      RangeError,
    );
    expect(() => renderCard({ noteType: reversed, note: noteOf({}), templateOrd: -1 })).toThrow(
      "template -1 does not exist",
    );
  });
});

describe("renderCard — conditional sections", () => {
  const nt = basic(
    "{{Frente}}{{#Verso}} / {{Verso}}{{/Verso}}{{^Verso}} (sem verso){{/Verso}}",
    "",
  );

  it("shows {{#Field}} only when the field has content", () => {
    expect(
      renderCard({ noteType: nt, note: noteOf({ front: "a", back: "b" }), templateOrd: 0 }).front,
    ).toBe("a / b");
  });

  it("shows {{^Field}} only when the field is empty", () => {
    expect(
      renderCard({ noteType: nt, note: noteOf({ front: "a", back: "<br>" }), templateOrd: 0 })
        .front,
    ).toBe("a (sem verso)");
  });

  it("supports nested sections", () => {
    const nested = basic("{{#Frente}}A{{#Verso}}B{{/Verso}}C{{/Frente}}", "");
    const render = (back: string) =>
      renderCard({ noteType: nested, note: noteOf({ front: "x", back }), templateOrd: 0 }).front;
    expect(render("y")).toBe("ABC");
    expect(render("")).toBe("AC");
  });

  it("treats sections on unknown fields as empty", () => {
    const nt = basic("{{#Nope}}x{{/Nope}}{{^Nope}}y{{/Nope}}", "");
    expect(renderCard({ noteType: nt, note: noteOf({}), templateOrd: 0 }).front).toBe("y");
  });

  it("only closes the innermost open section", () => {
    const nt = basic("{{#Frente}}a{{/Verso}}b{{/Frente}}c{{/}}d", "");
    const render = (front: string) =>
      renderCard({ noteType: nt, note: noteOf({ front, back: "" }), templateOrd: 0 }).front;
    expect(render("x")).toBe("abcd");
    expect(render("")).toBe("cd");
  });

  it("ignores a stray closing tag and runs an unclosed section to the end", () => {
    const odd = basic("a{{/Verso}}b{{#Verso}}c", "");
    const render = (back: string) =>
      renderCard({ noteType: odd, note: noteOf({ front: "", back }), templateOrd: 0 }).front;
    expect(render("y")).toBe("abc");
    expect(render("")).toBe("ab");
  });
});

describe("renderCard — cloze", () => {
  const note = noteOf({ text: "{{c1::Brasília}} fica no {{c2::Planalto}}", extra: "dica" });

  it("renders card N from cloze number N+1", () => {
    expect(renderCard({ noteType: cloze, note, templateOrd: 1 })).toEqual({
      front: 'Brasília fica no <span class="cloze">[…]</span>',
      back: 'Brasília fica no <span class="cloze">Planalto</span><br>dica',
    });
  });

  it("renders clozes inside formulas on both sides", () => {
    const math = noteOf({ text: "\\(x = {{c1::\\frac{a}{b}}}\\)", extra: "" });
    expect(renderCard({ noteType: cloze, note: math, templateOrd: 0 })).toEqual({
      front: "\\(x = \\htmlClass{cloze}{[\\dots]}\\)",
      back: "\\(x = \\htmlClass{cloze}{\\frac{a}{b}}\\)<br>",
    });
  });

  it("only uses the first template of a cloze note type", () => {
    expect(() => renderCard({ noteType: cloze, note, templateOrd: -1 })).toThrow(RangeError);
  });
});

describe("generateCards", () => {
  it("creates a card for each template whose front uses a non-empty field", () => {
    expect(generateCards(reversed, noteOf({ front: "cat", back: "gato" }))).toEqual([0, 1]);
    expect(generateCards(reversed, noteOf({ front: "cat", back: "<br>" }))).toEqual([0]);
    expect(generateCards(reversed, noteOf({ front: "", back: "" }))).toEqual([]);
  });

  it("does not count static text or hidden sections", () => {
    const nt = basic("Traduza: {{#Verso}}{{Frente}}{{/Verso}}", "");
    expect(generateCards(nt, noteOf({ front: "cat", back: "" }))).toEqual([]);
    expect(generateCards(nt, noteOf({ front: "cat", back: "x" }))).toEqual([0]);
  });

  it("counts a field used only in a section condition as not enough", () => {
    const nt = basic("{{#Frente}}?{{/Frente}}", "");
    expect(generateCards(nt, noteOf({ front: "cat", back: "" }))).toEqual([]);
  });

  it("creates one card per cloze number in the cloze field", () => {
    const note = noteOf({ text: "{{c2::a}} {{c1::b}} {{c2::c}} {{c4::d}}", extra: "{{c9::x}}" });
    expect(generateCards(cloze, note)).toEqual([0, 1, 3]);
  });

  it("collects clozes from every cloze field, including inside sections", () => {
    const two = makeNoteType({
      ...cloze,
      templates: [
        {
          id: "c",
          name: "Omissão",
          front: "{{cloze:Texto}}{{#Extra}}{{cloze:Extra}}{{/Extra}}{{cloze:Nope}}",
          back: "",
        },
      ],
    });
    const note = noteOf({ text: "{{c10::a}}", extra: "{{c2::b}}" });
    expect(generateCards(two, note)).toEqual([1, 9]);
    expect(generateCards(two, noteOf({ text: "{{c1::a}}", extra: "" }))).toEqual([0]);
  });

  it("creates no card for a cloze note without clozes", () => {
    expect(generateCards(cloze, noteOf({ text: "nothing", extra: "" }))).toEqual([]);
  });
});
