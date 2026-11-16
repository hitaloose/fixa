import type { ComponentType, ReactNode } from "react";
import { Icon, type IconName } from "../primitives/Icon";

export interface TabBarItem {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
}

type LinkProps = {
  href: string;
  className?: string;
  "aria-current"?: "page";
  children?: ReactNode;
};

export interface TabBarProps {
  label: string;
  items: TabBarItem[];
  /** Router-aware link; defaults to a plain anchor. */
  linkAs?: ComponentType<LinkProps>;
}

function Anchor(props: LinkProps) {
  return <a {...props} />;
}

/** Bottom navigation: 84px including the safe area (docs/09-design.md). */
export function TabBar({ label, items, linkAs: Link = Anchor }: TabBarProps) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex h-[calc(var(--spacing-tabbar)-env(safe-area-inset-bottom))] max-w-xl">
        {items.map((item) => (
          <li key={item.href} className="flex-1">
            <Link
              href={item.href}
              {...(item.active ? { "aria-current": "page" as const } : {})}
              className={`flex h-full min-h-11 flex-col items-center justify-center gap-1 text-xs font-medium ${
                item.active ? "text-primary" : "text-muted"
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
