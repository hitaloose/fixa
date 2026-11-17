import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom gaps used by Vaul/Radix (environment edges, not units under test).
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom has no layout; ProseMirror (Tiptap) asks for rects when scrolling the selection.
const emptyRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
const zeroRect = () => new DOMRect(0, 0, 0, 0);
for (const proto of [Element.prototype, Range.prototype]) {
  if (!proto.getClientRects) proto.getClientRects = emptyRects;
}
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = zeroRect;
if (!document.elementFromPoint) document.elementFromPoint = () => null;

afterEach(() => {
  cleanup();
});
