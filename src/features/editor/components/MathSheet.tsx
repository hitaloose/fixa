import { useEffect, useId, useRef, useState } from "react";
import { t } from "../../../i18n";
import { loadMathLive, watchVirtualKeyboard } from "../../../lib/math/mathlive";
import { renderLatex } from "../../../lib/math/render";
import { Button, Sheet } from "../../../ui";

export interface MathValue {
  latex: string;
  display: boolean;
}

export interface MathSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: MathValue;
  isNew: boolean;
  onSave: (value: MathValue) => void;
  onRemove: () => void;
  /** Defines the <math-field> element (MathLive, loaded on demand). */
  loadMathField?: () => Promise<void>;
}

type MathFieldElement = HTMLElement & { value: string };

/** MathLive's virtual keyboard: appended to <body>, outside the sheet, yet part of it. */
const VIRTUAL_KEYBOARD = ".ML__keyboard";

/** MathLive's <math-field>, created once the library has loaded. */
function VisualField({
  latex,
  onChange,
  load,
  onKeyboardHeight,
}: {
  latex: string;
  onChange: (latex: string) => void;
  load: () => Promise<void>;
  onKeyboardHeight: (px: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<MathFieldElement | null>(null);
  const initial = useRef(latex);
  const emit = useRef(onChange);
  emit.current = onChange;
  const keyboard = useRef(onKeyboardHeight);
  keyboard.current = onKeyboardHeight;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unwatch = () => {};
    void load().then(() => {
      if (cancelled || !host.current) return;
      const el = document.createElement("math-field") as MathFieldElement;
      el.setAttribute("aria-label", t.editor.math.field);
      // Colours from the app tokens: MathLive paints the field with the system "field" colour,
      // which stays white on iOS even in the dark theme.
      el.className =
        "block w-full min-h-14 rounded-field border border-line bg-surface px-3 py-2 text-xl text-ink";
      el.value = initial.current;
      el.addEventListener("input", () => emit.current(el.value));
      host.current.append(el);
      el.focus();
      field.current = el;
      unwatch = watchVirtualKeyboard((px) => keyboard.current(px));
      setReady(true);
    });
    return () => {
      cancelled = true;
      unwatch();
      keyboard.current(0);
      field.current?.remove();
    };
  }, [load]);

  return (
    <div ref={host}>
      {ready ? null : <p className="text-sm text-muted">{t.editor.math.loading}</p>}
    </div>
  );
}

function Preview({ latex, display }: MathValue) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (ref.current) void renderLatex(ref.current, latex, display);
  }, [latex, display]);
  return (
    <section aria-labelledby={id} className="rounded-field bg-bg px-3 py-2">
      <h3 id={id} className="sr-only">
        {t.editor.math.preview}
      </h3>
      <div ref={ref} className="overflow-x-auto text-center text-lg" />
    </section>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-flow-col gap-1 rounded-button bg-bg p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className="min-h-11 rounded-button px-3 text-sm font-medium aria-pressed:bg-surface aria-pressed:shadow-sm"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet to write a formula: MathLive (visual) or raw LaTeX, inline or display. */
export function MathSheet({
  open,
  onOpenChange,
  initial,
  isNew,
  onSave,
  onRemove,
  loadMathField = loadMathLive,
}: MathSheetProps) {
  const [latex, setLatex] = useState(initial.latex);
  const [display, setDisplay] = useState(initial.display);
  const [mode, setMode] = useState<"visual" | "latex">("visual");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const latexId = useId();
  const m = t.editor.math;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={m.title}
      closeLabel={t.common.close}
      outsideParts={VIRTUAL_KEYBOARD}
    >
      <div className="flex flex-col gap-3">
        <Toggle
          options={[
            { value: "visual", label: m.visual },
            { value: "latex", label: m.latex },
          ]}
          value={mode}
          onChange={(v) => setMode(v as "visual" | "latex")}
        />
        {mode === "visual" ? (
          <VisualField
            latex={latex}
            onChange={setLatex}
            load={loadMathField}
            onKeyboardHeight={setKeyboardHeight}
          />
        ) : (
          <>
            <label htmlFor={latexId} className="sr-only">
              {m.latex}
            </label>
            <textarea
              id={latexId}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              rows={3}
              spellCheck={false}
              autoCapitalize="none"
              className="rounded-field border border-line bg-surface px-3 py-2 font-mono text-field"
            />
            <Preview latex={latex} display={display} />
          </>
        )}
        <Toggle
          options={[
            { value: "inline", label: m.inline },
            { value: "display", label: m.display },
          ]}
          value={display ? "display" : "inline"}
          onChange={(v) => setDisplay(v === "display")}
        />
        <div className="flex gap-2">
          {isNew ? null : (
            <Button variant="danger" onClick={onRemove} className="flex-1">
              {m.remove}
            </Button>
          )}
          <Button
            onClick={() => onSave({ latex: latex.trim(), display })}
            disabled={latex.trim() === ""}
            className="flex-1"
          >
            {isNew ? m.insert : m.save}
          </Button>
        </div>
        {/* Keeps the sheet's content above MathLive's virtual keyboard. */}
        <div data-testid="keyboard-space" aria-hidden="true" style={{ height: keyboardHeight }} />
      </div>
    </Sheet>
  );
}
