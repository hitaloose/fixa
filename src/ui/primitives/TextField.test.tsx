import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchField } from "../patterns/SearchField";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("is a text box labelled by its label", () => {
    render(<TextField label="Nome" value="" onChange={() => {}} />);
    expect(screen.getByRole("textbox", { name: "Nome" })).toBeInTheDocument();
  });

  it("reports typed text", async () => {
    const onChange = vi.fn();
    render(<TextField label="Nome" value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Nome" }), "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("is described by its hint", () => {
    render(<TextField label="Nome" hint="Use :: para subbaralhos" value="" onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription("Use :: para subbaralhos");
  });

  it("announces an error and marks the field invalid", () => {
    render(<TextField label="Nome" hint="Dica" error="Já existe" value="" onChange={() => {}} />);
    const box = screen.getByRole("textbox");
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("Dica Já existe");
    expect(screen.getByRole("alert")).toHaveTextContent("Já existe");
  });

  it("is valid without an error", () => {
    render(<TextField label="Nome" value="" onChange={() => {}} />);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid");
  });
});

describe("SearchField", () => {
  it("is a search box with an accessible name", () => {
    render(
      <SearchField
        label="Buscar baralhos"
        clearLabel="Limpar busca"
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("searchbox", { name: "Buscar baralhos" })).toBeInTheDocument();
  });

  it("offers a clear button only when there is text", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SearchField label="Buscar" clearLabel="Limpar busca" value="" onChange={onChange} />,
    );
    expect(screen.queryByRole("button", { name: "Limpar busca" })).not.toBeInTheDocument();
    rerender(
      <SearchField label="Buscar" clearLabel="Limpar busca" value="ing" onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("reports typed text", async () => {
    const onChange = vi.fn();
    render(<SearchField label="Buscar" clearLabel="Limpar" value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole("searchbox"), "x");
    expect(onChange).toHaveBeenCalledWith("x");
  });
});
