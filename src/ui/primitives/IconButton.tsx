import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> {
  icon: IconName;
  /** Required: an icon-only button needs an accessible name (CLAUDE.md › Acessibilidade). */
  label: string;
}

export function IconButton({
  icon,
  label,
  type = "button",
  className = "",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`inline-flex size-11 items-center justify-center rounded-button text-ink ${className}`}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
