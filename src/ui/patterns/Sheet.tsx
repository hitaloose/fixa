import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { IconButton } from "../primitives/IconButton";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Accessible name of the close button (from i18n). */
  closeLabel: string;
  children: ReactNode;
  /**
   * CSS selector of elements rendered outside the sheet that still belong to it (e.g. MathLive's
   * virtual keyboard, appended to <body>): touching them must not close the sheet.
   */
  outsideParts?: string;
}

/** Bottom sheet (Vaul on Radix Dialog): focus trap, Escape, drag to dismiss. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  outsideParts,
}: SheetProps) {
  const keepOpenOnParts = (e: { target: EventTarget | null; preventDefault: () => void }) => {
    if (outsideParts && e.target instanceof Element && e.target.closest(outsideParts)) {
      e.preventDefault();
    }
  };
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-20 bg-ink/40" />
        <Drawer.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          onInteractOutside={keepOpenOnParts}
          className="fixed inset-x-0 bottom-0 z-30 mx-auto max-h-[90dvh] max-w-xl overflow-y-auto rounded-t-section bg-surface px-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] outline-none"
        >
          <div aria-hidden="true" className="mx-auto mb-2 h-1.5 w-10 rounded-chip bg-line" />
          <div className="flex items-start gap-2">
            <div className="flex-1 pt-2">
              <Drawer.Title className="font-display text-xl font-semibold">{title}</Drawer.Title>
              {description ? (
                <Drawer.Description className="mt-1 text-sm text-muted">
                  {description}
                </Drawer.Description>
              ) : null}
            </div>
            <IconButton icon="close" label={closeLabel} onClick={() => onOpenChange(false)} />
          </div>
          <div className="mt-3">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
