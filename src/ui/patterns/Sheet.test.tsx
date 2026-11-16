import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("renders nothing while closed", () => {
    render(
      <Sheet open={false} onOpenChange={() => {}} title="Ações" closeLabel="Fechar">
        <p>conteúdo</p>
      </Sheet>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a dialog named by its title, showing its content", () => {
    render(
      <Sheet open onOpenChange={() => {}} title="Ações do baralho" closeLabel="Fechar">
        <p>conteúdo</p>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Ações do baralho" });
    expect(dialog).toHaveTextContent("conteúdo");
  });

  it("is described by its description when given", () => {
    render(
      <Sheet
        open
        onOpenChange={() => {}}
        title="Excluir"
        description="Isso não pode ser desfeito."
        closeLabel="Fechar"
      >
        <p />
      </Sheet>,
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("Isso não pode ser desfeito.");
  });

  it("asks to close from its close button", async () => {
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange} title="Ações" closeLabel="Fechar">
        <p />
      </Sheet>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks to close with Escape", async () => {
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange} title="Ações" closeLabel="Fechar">
        <button type="button">ação</button>
      </Sheet>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
