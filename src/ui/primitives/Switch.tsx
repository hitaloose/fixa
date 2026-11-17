import { useId } from "react";

export interface SwitchProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** On/off setting: a real button with role="switch", the whole row is the touch target. */
export function Switch({ label, hint, checked, onChange }: SwitchProps) {
  const labelId = useId();
  const hintId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={hint ? hintId : undefined}
      onClick={() => onChange(!checked)}
      className="group flex min-h-11 w-full items-center gap-3 py-2 text-left"
    >
      <span className="flex flex-1 flex-col">
        <span id={labelId} className="font-medium">
          {label}
        </span>
        {hint ? (
          <span id={hintId} className="text-xs text-muted">
            {hint}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-chip bg-line transition-colors group-aria-checked:bg-primary"
      >
        <span className="absolute top-0.5 left-0.5 size-6 rounded-full bg-surface shadow transition-transform group-aria-checked:translate-x-5" />
      </span>
    </button>
  );
}
