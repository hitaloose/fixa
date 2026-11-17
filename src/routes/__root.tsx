import { createRootRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ThemeSync } from "../app/ThemeSync";
import { UpdatePrompt } from "../app/UpdatePrompt";
import { t } from "../i18n/pt-BR";
import { AppShell, TabBar, type TabBarItem } from "../ui";

const TABS = [
  { href: "/", label: t.nav.decks, icon: "decks" },
  { href: "/browse", label: t.nav.browse, icon: "browse" },
  { href: "/add", label: t.nav.add, icon: "add" },
  { href: "/stats", label: t.nav.stats, icon: "stats" },
] as const;

function RouterLink({ href, ...rest }: { href: string; className?: string; children?: ReactNode }) {
  return <Link to={href} {...rest} />;
}

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items: TabBarItem[] = TABS.map((tab) => ({
    ...tab,
    // The decks tab also owns deck screens (/decks/...).
    active:
      tab.href === "/"
        ? pathname === "/" || pathname.startsWith("/decks")
        : pathname.startsWith(tab.href),
  }));
  return (
    <AppShell nav={<TabBar label={t.nav.label} items={items} linkAs={RouterLink} />}>
      <Outlet />
      <UpdatePrompt />
      <ThemeSync />
    </AppShell>
  );
}

export const Route = createRootRoute({ component: RootLayout });
