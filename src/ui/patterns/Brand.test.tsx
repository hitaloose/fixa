import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Brand } from "./Brand";

describe("Brand", () => {
  it("shows the logo, named once for screen readers", () => {
    render(<Brand />);
    expect(screen.getByRole("img", { name: "Fixa" })).toHaveAttribute("src", "/favicon.svg");
    expect(screen.getByText("Fixa", { selector: "span" })).toHaveAttribute("aria-hidden", "true");
  });

  it("shows an action at the end of the row", () => {
    render(<Brand action={<a href="/settings">Ajustes</a>} />);
    expect(screen.getByRole("link", { name: "Ajustes" })).toBeInTheDocument();
  });
});
