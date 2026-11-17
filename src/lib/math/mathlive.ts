/**
 * MathLive (formula editing, docs/07-formulas.md) is heavy, so it is loaded only when the
 * formula sheet opens. Its fonts share names with KaTeX's (KaTeX_*), so the KaTeX stylesheet
 * provides them and MathLive is told not to fetch its own; sounds are off.
 */
export async function loadMathLive(): Promise<void> {
  const [{ MathfieldElement }] = await Promise.all([
    import("mathlive"),
    import("katex/dist/katex.min.css"),
  ]);
  MathfieldElement.fontsDirectory = null;
  MathfieldElement.soundsDirectory = null;
}

type VirtualKeyboard = EventTarget & { visible: boolean; boundingRect: DOMRect };

/**
 * Reports the height MathLive's virtual keyboard covers (0 while hidden), now and on every
 * change, so a bottom sheet can keep its content above it. Returns the unsubscribe function.
 */
export function watchVirtualKeyboard(onHeight: (px: number) => void): () => void {
  const keyboard = (window as unknown as { mathVirtualKeyboard?: VirtualKeyboard })
    .mathVirtualKeyboard;
  if (!keyboard) return () => {};
  const report = () => onHeight(keyboard.visible ? keyboard.boundingRect.height : 0);
  keyboard.addEventListener("geometrychange", report);
  keyboard.addEventListener("virtual-keyboard-toggle", report);
  report();
  return () => {
    keyboard.removeEventListener("geometrychange", report);
    keyboard.removeEventListener("virtual-keyboard-toggle", report);
  };
}
