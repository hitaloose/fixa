import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FieldEditor, type FieldEditorProps } from "./FieldEditor";

function Harness(
  props: Partial<FieldEditorProps> & { initial?: string; spy?: (v: string) => void },
) {
  const { initial = "", spy, ...rest } = props;
  const [value, setValue] = useState(initial);
  return (
    <>
      <FieldEditor
        label="Frente"
        value={value}
        onChange={(v) => {
          setValue(v);
          spy?.(v);
        }}
        storeMedia={async () => "x.png"}
        resolveMedia={async () => undefined}
        {...rest}
      />
      <output data-testid="value">{value}</output>
      <button type="button" onClick={() => setValue("from outside")}>
        reset
      </button>
    </>
  );
}

const box = () => screen.getByRole("textbox", { name: "Frente" });
const value = () => screen.getByTestId("value").textContent;

async function selectAll() {
  await userEvent.click(box());
  await userEvent.keyboard("{Control>}a{/Control}");
}

describe("FieldEditor", () => {
  it("is a multiline textbox named by the field, showing its content", async () => {
    render(<Harness initial="<b>cat</b>" />);
    expect(box()).toHaveAttribute("aria-multiline", "true");
    await waitFor(() => expect(box()).toHaveTextContent("cat"));
    expect(box().querySelector("strong")).not.toBeNull();
  });

  // Key-by-key typing is covered by e2e: jsdom has no real selection/layout for ProseMirror.
  it("reports entered text as field HTML", async () => {
    render(<Harness />);
    await userEvent.click(box());
    await userEvent.paste("cat");
    await waitFor(() => expect(value()).toBe("cat"));
  });

  it("applies bold, italic and underline to the selection", async () => {
    render(<Harness initial="cat" />);
    await selectAll();
    await userEvent.click(screen.getByRole("button", { name: "Negrito" }));
    await waitFor(() => expect(value()).toBe("<strong>cat</strong>"));
    expect(screen.getByRole("button", { name: "Negrito" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Itálico" }));
    await userEvent.click(screen.getByRole("button", { name: "Sublinhado" }));
    await waitFor(() => expect(value()).toBe("<strong><em><u>cat</u></em></strong>"));
  });

  it("wraps the selection in a new cloze deletion", async () => {
    render(<Harness initial="Brasília" nextCloze={3} />);
    await selectAll();
    await userEvent.click(screen.getByRole("button", { name: "Omissão" }));
    await waitFor(() => expect(value()).toBe("{{c3::Brasília}}"));
  });

  it("offers cloze deletion only when asked to", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "Omissão" })).not.toBeInTheDocument();
  });

  it("stores a picked image and inserts it by file name", async () => {
    const storeMedia = vi.fn(async () => "abc.png");
    render(<Harness storeMedia={storeMedia} />);
    const file = new File(["png"], "gato.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("Adicionar imagem"), file);
    await waitFor(() => expect(value()).toBe('<img src="abc.png">'));
    expect(storeMedia).toHaveBeenCalledWith(file);
  });

  it("stores a picked audio file and inserts a player", async () => {
    render(<Harness storeMedia={async () => "abc.mp3"} />);
    const file = new File(["mp3"], "som.mp3", { type: "audio/mpeg" });
    await userEvent.upload(screen.getByLabelText("Adicionar áudio"), file);
    await waitFor(() => expect(value()).toBe('<audio controls="" src="abc.mp3"></audio>'));
  });

  it("shows stored media through resolved URLs without changing the field HTML", async () => {
    render(<Harness initial='<img src="abc.png">' resolveMedia={async () => "blob:abc"} />);
    await waitFor(() => expect(within(box()).getByRole("img")).toHaveAttribute("src", "blob:abc"));
    expect(value()).toBe('<img src="abc.png">');
  });

  it("follows value changes made from outside", async () => {
    render(<Harness initial="cat" />);
    await userEvent.click(screen.getByRole("button", { name: "reset" }));
    await waitFor(() => expect(box()).toHaveTextContent("from outside"));
  });
});
