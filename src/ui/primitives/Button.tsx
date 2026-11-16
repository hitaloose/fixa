import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-surface",
  secondary: "bg-surface text-ink border border-line",
  ghost: "bg-transparent text-primary",
  danger: "bg-danger text-surface",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/** Touch target ≥ 44px (docs/09-design.md). Defaults to type="button" so it never submits by accident. */
export function Button({
  variant = "primary",
  type = "button",
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-4 font-semibold disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
