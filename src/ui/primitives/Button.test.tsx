import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";

describe("Button", () => {
  it("renders a real button with its accessible name", () => {
    render(<Button>Estudar</Button>);
    expect(screen.getByRole("button", { name: "Estudar" })).toBeInTheDocument();
  });

  it("does not submit forms by default", () => {
    render(<Button>Ok</Button>);
    expect(screen.getByRole("button", { name: "Ok" })).toHaveAttribute("type", "button");
  });

  it("can be a submit button when asked", () => {
    render(<Button type="submit">Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveAttribute("type", "submit");
  });

  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Bom</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Bom" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Bom
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Bom" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is reachable and activatable with the keyboard", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Fácil</Button>);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Fácil" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Icon", () => {
  it("is decorative: hidden from assistive technology", () => {
    const { container } = render(<Icon name="decks" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });
});

describe("IconButton", () => {
  it("is named by its label, not by the icon", () => {
    render(<IconButton icon="add" label="Novo baralho" />);
    expect(screen.getByRole("button", { name: "Novo baralho" })).toBeInTheDocument();
  });

  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<IconButton icon="add" label="Adicionar" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
