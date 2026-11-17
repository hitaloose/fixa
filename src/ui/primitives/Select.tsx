import type { SelectHTMLAttributes } from "react";
import { Icon } from "./Icon";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Native <select> drawn like TextField. The native look is turned off because iOS draws it at
 * its own, shorter height (ignoring min-height and padding); the chevron replaces its arrow.
 * `className` places the control (width, margins); its look is fixed.
 */
export function Select({ className = "", children, ...rest }: SelectProps) {
  return (
    <div className={`relative flex ${className}`}>
      <select
        className="min-h-11 w-full min-w-0 appearance-none rounded-field border border-line bg-surface pr-10 pl-3 text-field font-normal text-ink outline-none focus:border-primary"
        {...rest}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
        <Icon name="chevronDown" className="size-5" />
      </span>
    </div>
  );
}
