import { describe, expect, it } from "vitest";
import { makeNoteType } from "../../../tests/factories";
import {
  addField,
  addTemplate,
  moveField,
  NoteTypeEditError,
  removeField,
  removeTemplate,
  renameField,
} from "./index";

const nt = () =>
  makeNoteType({
    templates: [
      {
        id: "t1",
        name: "Cartão 1",
        front: "{{Frente}}{{#Verso}}!{{/Verso}}",
        back: "{{FrontSide}}<hr>{{text:Verso}} {{ Verso }} {{^Verso}}-{{/Verso}}",
      },
    ],
  });
const ids = { next: () => "new-id" };

describe("renameField", () => {
  it("renames the field and every reference to it in the templates", () => {
    const out = renameField(nt(), "back", "Resposta");
    expect(out.fields.map((f) => f.name)).toEqual(["Frente", "Resposta"]);
    expect(out.templates[0]).toMatchObject({
      front: "{{Frente}}{{#Resposta}}!{{/Resposta}}",
      back: "{{FrontSide}}<hr>{{text:Resposta}} {{Resposta}} {{^Resposta}}-{{/Resposta}}",
    });
  });

  it("refuses blank, reserved or duplicate names", () => {
    expect(() => renameField(nt(), "back", "  ")).toThrow(new NoteTypeEditError("invalid-name"));
    expect(() => renameField(nt(), "back", "Frente")).toThrow(new NoteTypeEditError("name-taken"));
    expect(() => renameField(nt(), "back", "a:b")).toThrow(new NoteTypeEditError("invalid-name"));
    expect(() => renameField(nt(), "back", "FrontSide")).toThrow(
      new NoteTypeEditError("invalid-name"),
    );
  });
});

describe("addField / removeField / moveField", () => {
  it("adds a field at the end", () => {
    expect(addField(nt(), "Exemplo", ids).fields.at(-1)).toEqual({
      id: "new-id",
      name: "Exemplo",
      sticky: false,
      rtl: false,
    });
  });

  it("removes a field but never the last one", () => {
    expect(removeField(nt(), "back").fields.map((f) => f.name)).toEqual(["Frente"]);
    expect(() => removeField(removeField(nt(), "back"), "front")).toThrow(
      new NoteTypeEditError("last-field"),
    );
  });

  it("moves a field up or down", () => {
    expect(moveField(nt(), "back", -1).fields.map((f) => f.id)).toEqual(["back", "front"]);
    expect(moveField(nt(), "back", 1).fields.map((f) => f.id)).toEqual(["front", "back"]);
  });
});

describe("addTemplate / removeTemplate", () => {
  it("adds a card type showing the first field", () => {
    const out = addTemplate(nt(), "Cartão 2", ids);
    expect(out.templates.at(-1)).toEqual({
      id: "new-id",
      name: "Cartão 2",
      front: "{{Frente}}",
      back: "{{FrontSide}}<hr id=answer>",
    });
  });

  it("removes a card type but never the last one, and cloze types keep exactly one", () => {
    const two = addTemplate(nt(), "Cartão 2", ids);
    expect(removeTemplate(two, "t1").templates.map((t) => t.name)).toEqual(["Cartão 2"]);
    expect(() => removeTemplate(nt(), "t1")).toThrow(new NoteTypeEditError("last-template"));
    expect(() => addTemplate(makeNoteType({ kind: "cloze" }), "Outro", ids)).toThrow(
      new NoteTypeEditError("cloze-single-template"),
    );
  });
});
