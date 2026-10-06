/** Mobile menu island (spec §4.1): full-height sheet, focus trap, Esc to close.
 *  Mounted into #menu-island by islands-entry (the static page keeps a no-JS link). */
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#privacy", label: "Privacy" },
  { href: "/#questions", label: "Questions" },
  { href: "/login", label: "Sign in" },
];

export function MenuIsland() {
  const [open, setOpen] = useState(false);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    sheetRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        previouslyFocused.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const focusables = [...sheetRef.current.querySelectorAll<HTMLElement>("a, button")];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-11 items-center rounded-control px-2 text-secondary hover:text-text"
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen(true)}
      >
        Menu
      </button>
      {open ? (
        <div className="fixed inset-0 z-50" id="site-menu">
          <div className="absolute inset-0 bg-[var(--scrim)]" aria-hidden onClick={() => setOpen(false)} />
          <div
            ref={sheetRef}
            className="absolute inset-y-0 right-0 flex w-72 flex-col gap-1 border-l border-border bg-surface p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <button
              type="button"
              className="mb-2 inline-flex min-h-11 items-center justify-between rounded-control px-2 text-secondary hover:bg-surface-2"
              onClick={() => setOpen(false)}
            >
              Close menu
            </button>
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  "flex min-h-12 items-center rounded-control px-2 text-body text-secondary hover:bg-surface-2 hover:text-text",
                  link.label === "Sign in" && "mt-auto",
                )}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
