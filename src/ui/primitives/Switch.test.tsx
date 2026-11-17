import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Switch } from "./Switch";

function Harness({ initial = false }: { initial?: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <Switch label="Mostrar cronômetro" hint="Durante o estudo" checked={on} onChange={setOn} />
  );
}

describe("Switch", () => {
  it("is a switch named by its label, described by its hint", () => {
    render(<Harness initial />);
    const sw = screen.getByRole("switch", { name: "Mostrar cronômetro" });
    expect(sw).toBeChecked();
    expect(sw).toHaveAccessibleDescription("Durante o estudo");
  });

  it("toggles by click and keyboard", async () => {
    render(<Harness />);
    const sw = screen.getByRole("switch", { name: "Mostrar cronômetro" });
    expect(sw).not.toBeChecked();
    await userEvent.click(sw);
    expect(sw).toBeChecked();
    sw.focus();
    await userEvent.keyboard(" ");
    expect(sw).not.toBeChecked();
  });
});
