/** Public site shell (spec §4.1/§4.12): sticky nav, footer, theme control.
 *  Plain anchors — the public pages never mount the router, keeping the landing
 *  bundle free of the app and its data layer. */
import { useEffect, useState } from "react";

import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#privacy", label: "Privacy" },
  { href: "/#questions", label: "Questions" },
];

function Wordmark() {
  return (
    <a href="/" className="flex min-h-11 items-center gap-2 font-semibold" aria-label="SenseHeaven home">
      <BrandMark size={26} />
      <span className="font-display text-body font-semibold">SenseHeaven</span>
    </a>
  );
}

export function HomeLayout({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);


  return (
    <div className="min-h-screen bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to main content
      </a>

      <header
        className={cn(
          "sticky top-0 z-40 bg-bg transition-[border-color] duration-200",
          scrolled ? "border-b border-border" : "border-b border-transparent",
        )}
      >
        <div className="mx-auto flex min-h-14 max-w-[1240px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1 md:min-h-16 md:px-8">
          <Wordmark />
          <nav aria-label="Site" className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="inline-flex min-h-11 min-w-11 items-center text-secondary hover:text-text lg:min-h-6 lg:min-w-0">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a href="/login" className="hidden min-h-11 items-center px-3 text-secondary hover:text-text md:inline-flex lg:min-h-6">
              Sign in
            </a>
            <a
              href="/download"
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-control bg-primary px-3 font-medium text-[max(12px,min(14.4px,1.8vw))] text-on-primary hover:bg-primary-hover lg:min-h-10"
            >
              Get the app
            </a>
            <div id="menu-island" className="contents md:hidden" />
            <noscript>
              <a href="/#how-it-works" className="text-secondary">How it works</a>
            </noscript>
          </div>
        </div>
      </header>

      <div id="menu-sheet" className="contents" />

      <main id="main">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-10 md:grid-cols-4 md:px-8">
          <div>
            <p className="font-display font-semibold">SenseHeaven</p>
            <p className="mt-1 max-w-[26ch] text-caption text-text-subtle">
              Know how they're doing, not just how long.
            </p>
          </div>
          <nav aria-label="Product">
            <p className="text-caption font-medium text-text-subtle">Product</p>
            <ul className="mt-2 space-y-1">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a className="inline-flex min-h-11 min-w-11 items-center text-secondary hover:text-text lg:min-h-6 lg:min-w-0" href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Account">
            <p className="text-caption font-medium text-text-subtle">Account</p>
            <ul className="mt-2 space-y-1">
              <li><a className="inline-flex min-h-11 min-w-11 items-center text-secondary hover:text-text lg:min-h-6 lg:min-w-0" href="/login">Sign in</a></li>
              <li><a className="inline-flex min-h-11 min-w-11 items-center text-secondary hover:text-text lg:min-h-6 lg:min-w-0" href="/download">Get the app</a></li>
            </ul>
          </nav>
          <div>
            <p className="text-caption font-medium text-text-subtle">Legal</p>
            <ul className="mt-2 space-y-1">
              <li><a className="inline-flex min-h-11 min-w-11 items-center text-secondary hover:text-text lg:min-h-6 lg:min-w-0" href="/privacy">Privacy</a></li>
            </ul>
            <p className="mt-4 text-caption font-medium text-text-subtle">Theme</p>
            <div className="mt-2" id="footer-theme">
              <ThemeToggle />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-[1240px] px-4 pb-8 md:px-8">
          <p className="text-caption text-text-subtle">© {new Date().getFullYear()} SenseHeaven</p>
        </div>
      </footer>
    </div>
  );
}
