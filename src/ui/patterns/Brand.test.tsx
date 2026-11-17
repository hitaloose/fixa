import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Brand } from "./Brand";

describe("Brand", () => {
  it("shows the logo, named once for screen readers", () => {
    render(<Brand />);
    expect(screen.getByRole("img", { name: "Fixa" })).toHaveAttribute("src", "/favicon.svg");
    expect(screen.getByText("Fixa", { selector: "span" })).toHaveAttribute("aria-hidden", "true");
  });
});
