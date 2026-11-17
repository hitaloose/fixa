import { useEffect, useRef } from "react";

export interface ToastProps {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}

/** Short, non-blocking confirmation above the tab bar, announced by screen readers. */
export function Toast({ message, onDismiss, durationMs = 3000 }: ToastProps) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new message restarts the countdown
  useEffect(() => {
    const timer = setTimeout(() => dismiss.current(), durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs]);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+12px)] z-50 mx-auto max-w-sm rounded-list bg-ink px-4 py-3 text-center text-sm text-surface shadow-lg"
    >
      {message}
    </div>
  );
}
