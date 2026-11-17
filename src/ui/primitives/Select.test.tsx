import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./Select";

describe("Select", () => {
  it("is a combobox showing the chosen option", () => {
    render(
      <Select aria-label="Baralho" value="b" onChange={() => {}}>
        <option value="a">Geral</option>
        <option value="b">Física</option>
      </Select>,
    );
    expect(screen.getByRole("combobox", { name: "Baralho" })).toHaveDisplayValue("Física");
  });

  it("reports the picked option", async () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="Baralho" value="a" onChange={(e) => onChange(e.target.value)}>
        <option value="a">Geral</option>
        <option value="b">Física</option>
      </Select>,
    );
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Baralho" }), "Física");
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
