import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("shows stored media through resolved URLs", async () => {
    const resolveMedia = async (name: string) => (name === "a.png" ? "blob:a" : undefined);
    render(
      <CardView
        html={'<img src="a.png"><audio controls src="b.mp3"></audio>'}
        resolveMedia={resolveMedia}
      />,
    );
    await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "blob:a"));
    expect(content().querySelector("audio")).toHaveAttribute("src", "b.mp3");
  });

  it("plays the card's audio in order when autoplay is on", async () => {
    const played: string[] = [];
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      played.push(this.getAttribute("src") ?? "");
      return Promise.resolve();
    });
    render(
      <CardView
        html={'<audio src="a.mp3"></audio><audio src="b.mp3"></audio>'}
        resolveMedia={async (name) => `blob:${name}`}
        autoplay
      />,
    );
    await waitFor(() => expect(played).toEqual(["blob:a.mp3"]));
    content().querySelector("audio")?.dispatchEvent(new Event("ended"));
    expect(played).toEqual(["blob:a.mp3", "blob:b.mp3"]);
  });

  it("stops audio when the card changes", () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const { rerender } = render(<CardView html={'<audio src="a.mp3"></audio>'} />);
    rerender(<CardView html="next" />);
    expect(pause).toHaveBeenCalledOnce();
  });

  it("does not play audio without autoplay", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    render(<CardView html={'<audio src="a.mp3"></audio>'} resolveMedia={async () => "blob:a"} />);
    await waitFor(() => expect(content().querySelector("audio")).toHaveAttribute("src", "blob:a"));
    expect(play).not.toHaveBeenCalled();
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
