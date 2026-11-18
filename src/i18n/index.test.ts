import { afterEach, describe, expect, it } from "vitest";
import { en } from "./en";
import { LOCALES, setLocale, t } from "./index";
import { t as ptBR } from "./pt-BR";

afterEach(() => setLocale("pt-BR"));

describe("locale", () => {
  it("starts in pt-BR", () => {
    expect(t).toBe(ptBR);
  });

  it("switches the live `t` binding", () => {
    setLocale("en");
    expect(t).toBe(en);
    setLocale("pt-BR");
    expect(t).toBe(ptBR);
  });

  it("lists the supported locales, pt-BR first", () => {
    expect(LOCALES).toEqual(["pt-BR", "en"]);
  });
});
