import { useEffect, useId, useState } from "react";
import { t } from "../../i18n/pt-BR";

export interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

/** Whole-number field with − / + buttons; typed values are clamped to [min, max]. */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  hint,
}: StepperProps) {
  const id = useId();
  const hintId = useId();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const button =
    "inline-flex size-11 items-center justify-center rounded-button border border-line bg-surface text-lg font-semibold disabled:opacity-40";

  return (
    <div className="flex min-h-11 items-center gap-3 py-1">
      <div className="flex flex-1 flex-col">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {hint ? (
          <span id={hintId} className="text-xs text-muted">
            {hint}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        aria-label={t.common.decrease(label)}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className={button}
      >
        −
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={text}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number.parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
        onBlur={() => setText(String(value))}
        className="h-11 w-20 rounded-field border border-line bg-surface text-center text-field tabular-nums"
      />
      <button
        type="button"
        aria-label={t.common.increase(label)}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        className={button}
      >
        +
      </button>
    </div>
  );
}
