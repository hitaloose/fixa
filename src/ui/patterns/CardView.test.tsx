import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardView } from "./CardView";

const content = () => screen.getByTestId("card-content");

describe("CardView", () => {
  it("renders the card HTML after sanitizing it", () => {
    render(
      <CardView html={'<b>cat</b><script>alert(1)</script><img src="x.png" onerror="alert(1)">'} />,
    );
    expect(content().innerHTML).toBe('<b>cat</b><img src="x.png">');
  });

  it("renders formulas with KaTeX", async () => {
    render(<CardView html={"\\(\\frac{3}{4}\\)"} />);
    await waitFor(() => expect(content().querySelector(".katex .mfrac")).not.toBeNull());
  });

  it("updates when the HTML changes", () => {
    const { rerender } = render(<CardView html="front" />);
    rerender(<CardView html="back" />);
    expect(content()).toHaveTextContent(/^back$/);
  });

  it("scopes the note type CSS to the card", () => {
    const { container } = render(<CardView html="x" css=".card { color: red }</style><b>" />);
    const style = container.querySelector("style");
    expect(style?.textContent).toBe("@scope (.fixa-card) {\n.card { color: red }<b>\n}");
    expect(container.firstElementChild).toHaveClass("fixa-card", "card");
  });

  it("adds no style element when the note type has no CSS", () => {
    const { container } = render(<CardView html="x" />);
    expect(container.querySelector("style")).toBeNull();
  });
});
