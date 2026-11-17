import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toast } from "./Toast";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("announces its message politely", () => {
    render(<Toast message="Cartão enterrado." onDismiss={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Cartão enterrado.");
  });

  it("dismisses itself after a few seconds", () => {
    const onDismiss = vi.fn();
    render(<Toast message="x" onDismiss={onDismiss} durationMs={3000} />);
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("restarts the countdown when the message changes", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Toast message="a" onDismiss={onDismiss} durationMs={1000} />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    rerender(<Toast message="b" onDismiss={onDismiss} durationMs={1000} />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
