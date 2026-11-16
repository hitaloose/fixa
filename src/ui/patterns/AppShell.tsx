import type { ReactNode } from "react";

/** Screen layout: safe-area aware content above the bottom navigation. */
export function AppShell({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg pt-[env(safe-area-inset-top)]">
      <main className="mx-auto max-w-xl px-4 pb-[calc(var(--spacing-tabbar)+16px)]">
        {children}
      </main>
      {nav}
    </div>
  );
}
