import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLayoutEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import { Stepper } from "./Stepper";

function Harness({
  initial = 5,
  min = 0,
  max = 9,
}: {
  initial?: number;
  min?: number;
  max?: number;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Stepper label="Novos por dia" value={value} min={min} max={max} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

/** Clears the field during the commit that shows it, before passive effects run. */
function ClearOnMount() {
  useLayoutEffect(() => {
    fireEvent.change(screen.getByRole("spinbutton", { name: "Novos por dia" }), {
      target: { value: "" },
    });
  }, []);
  return null;
}

const value = () => screen.getByTestId("value").textContent;

describe("Stepper", () => {
  it("is a number field with decrease and increase buttons", async () => {
    render(<Harness />);
    expect(screen.getByRole("spinbutton", { name: "Novos por dia" })).toHaveValue(5);
    await userEvent.click(screen.getByRole("button", { name: "Aumentar Novos por dia" }));
    expect(value()).toBe("6");
    await userEvent.click(screen.getByRole("button", { name: "Diminuir Novos por dia" }));
    await userEvent.click(screen.getByRole("button", { name: "Diminuir Novos por dia" }));
    expect(value()).toBe("4");
  });

  it("stays within its bounds", async () => {
    render(<Harness initial={9} min={8} max={9} />);
    expect(screen.getByRole("button", { name: "Aumentar Novos por dia" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Diminuir Novos por dia" }));
    expect(value()).toBe("8");
    expect(screen.getByRole("button", { name: "Diminuir Novos por dia" })).toBeDisabled();
  });

  it("accepts a typed number, clamped, and ignores anything else", async () => {
    render(<Harness />);
    const input = screen.getByRole("spinbutton", { name: "Novos por dia" });
    await userEvent.clear(input);
    await userEvent.type(input, "42");
    expect(value()).toBe("9");
    await userEvent.clear(input);
    expect(value()).toBe("9");
  });

  // Regression (CI flake in DeckOptionsScreen): when the field was edited right after it
  // appeared, before React's passive effects ran, the old value came back ("" → "20", then
  // typing "7" gave "207").
  it("keeps an edit made right after it appears", () => {
    render(
      <>
        <Stepper label="Novos por dia" value={20} onChange={() => {}} />
        <ClearOnMount />
      </>,
    );
    expect(screen.getByRole("spinbutton", { name: "Novos por dia" })).toHaveValue(null);
  });
});
