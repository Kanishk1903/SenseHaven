/** Public Home (spec: "SenseHeaven — Home Page Design, Build and Verification Prompt").
 *  "Quiet instrument" at page scale: typographic, annotated, printed-on-paper. The product
 *  shown is the real Overview components fed by sample data — no screenshots, no device
 *  frames, no invented facts. Every factual claim traces to code or the API (see
 *  verification/home/report.md). */
import { lazy, Suspense, useEffect, useRef, useState } from "react";

// the ribbon is below the fold: split + hydrate on visibility (spec §9.1)
const DayRibbon = lazy(() => import("@/components/charts/DayRibbon").then((m) => ({ default: m.DayRibbon })));
const RIBBON_FALLBACK_H = 96;

import { OrbMark } from "@/components/OrbMark";
import { StatusChip } from "@/components/StatusChip";
import { HomeLayout } from "@/features/home/HomeLayout";
import { DemoControls, DemoHeadline, DemoPanel } from "@/features/home/DemoIslands";
import { SAMPLE_DAY, SAMPLE_NOTES } from "@/features/home/data";
import { cn } from "@/lib/cn";

/** The hero demo: the real Now panel fed by sample states via the shared store (spec §4.2). */
function DemoNow() {
  return (
    <div>
      <div className="relative">
        <DemoHeadline />
        <DemoPanel />
      </div>
      <DemoControls />
      <p className="mt-2 text-caption text-text-subtle">
        Sample panel. Sample data — nothing here is a real child. Buttons do nothing here.
      </p>
    </div>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function SectionHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-1 font-display text-h2 font-semibold text-text" style={{ textWrap: "balance" }}>
      {children}
    </h2>
  );
}

function SectionFrame({
  id,
  children,
  band = false,
}: {
  id?: string;
  children: React.ReactNode;
  band?: boolean;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 border-t border-border", band && "bg-surface-2")}>
      <div className="mx-auto max-w-[1240px] px-4 py-[clamp(56px,9vw,128px)] md:px-8">
        <div className="mx-auto max-w-[900px] min-w-0">{children}</div>
      </div>
    </section>
  );
}

/** The signature section: a sample past day with numbered annotations on the ribbon. */
function SampleDay() {
  const stripRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = stripRef.current;
    if (!el || reduced) return;
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setRevealed(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <section id="sample-day" aria-labelledby="sample-day-heading" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto max-w-[1240px] px-4 py-[clamp(56px,9vw,128px)] md:px-8">
        <div className="mx-auto max-w-[900px]">
          <div className="min-w-0">
            <SectionHeading id="sample-day-heading">A sample day</SectionHeading>
            <p className="mt-2 max-w-[56ch] text-secondary">{SAMPLE_DAY.insight}</p>

            <div id="sample-ribbon" ref={stripRef} className="relative mt-6 min-w-0">
              <div
                className={cn(
                  "origin-left",
                  !reduced && (revealed ? "ribbon-revealed" : "ribbon-draw"),
                )}
              >
                <Suspense fallback={<div className="h-[96px] rounded-[6px] bg-surface-2" style={{ minHeight: RIBBON_FALLBACK_H }} aria-hidden />}>
                  <DayRibbon
                    buckets={SAMPLE_DAY.buckets}
                    episodes={SAMPLE_DAY.episodes}
                    sessions={SAMPLE_DAY.sessions}
                    showNow={false}
                    autoZoom={false}
                    noteMarkers={SAMPLE_NOTES.map((n, i) => ({ at: n.at, label: String(i + 1) }))}
                    ariaLabel="A sample day's Calm Index ribbon"
                  />
                </Suspense>
              </div>
            </div>

            {/* numbered notes double as the sub-1180 marginalia */}
            <ol className="mt-4 space-y-2">
              {SAMPLE_NOTES.map((note, i) => (
                <li key={note.at} className="flex gap-2 text-secondary">
                  <span aria-hidden className="tnum font-display font-semibold text-text">{i + 1}</span>
                  <span>
                    <span className="font-medium text-text">{note.title}.</span> {note.note}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

const CONTROLS: { action: string; outcome: string }[] = [
  { action: "Add time", outcome: "Adds minutes to the current session. Undo for a few seconds." },
  { action: "Lock now", outcome: "Locks the child's phone after a confirm." },
  { action: "End session", outcome: "Stops the current session." },
  { action: "Block an app", outcome: "From the Top apps list on the Overview." },
  { action: "When the phone is offline", outcome: "Limits still apply. Changes apply on reconnect." },
];

const NOT_DO: { we: string; because: string }[] = [
  { we: "Label your child", because: "We say 'stress signals' and 'breather' — never a verdict on a person." },
  { we: "Show red for a bad day", because: "Colour marks state, not blame." },
  { we: "Guess between readings", because: "Gaps stay gaps." },
  { we: "Sell or share data", because: "There are no third parties in the product: no trackers, no ad networks, no analytics." },
  { we: "Show your child your dashboard", because: "The dashboard lives on the parent's account only." },
  { we: "Store photos or video", because: "Expressions are read on the child's phone; only the derived Calm Index is synced." },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Does it work when the phone is offline?",
    a: "The limits you set are enforced on your child's phone, so they hold without internet. Changes you make while the phone is offline apply when it reconnects.",
  },
  {
    q: "What exactly is read from my child's phone?",
    a: "The child app reads facial-geometry landmarks from the camera and computes a Calm Index on the device. Photos and video never leave the phone — only the derived readings sync to the dashboard.",
  },
  {
    q: "Is the Calm Index a diagnosis?",
    a: "No. It is an estimate from facial expressions, summarised as Calm, Neutral or Stressed. It is not a medical or psychological assessment, and expressions vary between people, lighting and cameras.",
  },
  {
    q: "Can my child see the dashboard?",
    a: "No. The dashboard lives on your account. By default the child app shows no score or mood label about them either — you can turn mood labels on in the dashboard settings.",
  },
  {
    q: "How do we delete our data?",
    a: "In the dashboard, Settings has a danger zone: deleting a child removes everything collected about them — readings, sessions, app usage and alerts — while keeping the child and device entry.",
  },
  {
    q: "Which devices are supported?",
    a: "The child app runs on Android 13 or later. The parent dashboard works in any modern browser.",
  },
  {
    q: "What does it cost?",
    a: "There is no paid tier and no payment mechanism in the app.",
  },
  {
    q: "How do we stop using it?",
    a: "Turn monitoring off in the dashboard settings, or delete your child's data. The child app then shows that it has been unpaired and stops reporting.",
  },
];

export function HomePage() {
  const reduced = usePrefersReducedMotion();
  // route metadata (the prerendered home.html bakes the same values)
  useEffect(() => {
    document.title = "SenseHeaven: know how they're doing, not just how long";
    const set = (name: string, content: string, attr = "name") => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    set("description", "Screen time with a calm read: how long, how they seem to be feeling, and what to do next. Every reading is labelled as an estimate.");
    set("og:title", "SenseHeaven: know how they're doing, not just how long", "property");
    set("og:description", "Screen time with a calm read: how long, how they seem to be feeling, and what to do next.", "property");
    set("og:image", "/og.png", "property");
  }, []);

  return (
    <HomeLayout>
      <div data-testid="home-ready" lang="en">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1240px] px-4 pb-[clamp(40px,6vw,80px)] pt-[clamp(32px,5vw,64px)] md:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="min-w-0 lg:pt-10">
              <h1
                className="font-display font-normal text-text"
                style={{ fontSize: "clamp(2.5rem, 1.5rem + 4.4vw, 4.75rem)", lineHeight: 1.04, letterSpacing: "-0.02em", textWrap: "balance" }}
              >
                Know how they're doing, not just how long.
              </h1>
              <p className="mt-5 max-w-[52ch] text-[1.125rem]/7 text-secondary md:text-[1.25rem]/[1.9rem]">
                SenseHeaven gives parents a calm read on a child's screen time: how long, how
                they seem to be feeling, and what to do next. Every reading is labelled as an
                estimate.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <a
                  href="/download"
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-control bg-primary px-4 font-medium text-[max(12px,min(14.4px,1.8vw))] text-on-primary hover:bg-primary-hover lg:min-h-12"
                >
                  Get the app
                </a>
                <a href="#sample-day" className="inline-flex min-h-11 items-center px-2 text-secondary underline underline-offset-4 hover:text-text lg:min-h-6">
                  See a sample day
                </a>
              </div>
              <p className="mt-4 text-caption text-text-subtle">
                Android · Limits hold even when the phone is offline
              </p>
            </div>
            <div id="demo-root">
              <DemoNow />
            </div>
          </div>
        </section>

        {/* ── 1 · The tally ────────────────────────────────────────────────── */}
        <SectionFrame>
          <SectionHeading>A tally of minutes doesn't tell you how the minutes went.</SectionHeading>
          <p className="mt-4 max-w-[60ch] text-body/6 text-secondary">
            Two hours can be a calm drawing session or a tense evening over a game. Most tools
            count the hours and stop there. SenseHeaven adds the part parents actually wonder
            about: how it seemed to go.
          </p>
          <p className="mt-4 max-w-[60ch] text-caption text-text-subtle">
            Estimated from facial expressions on the child's phone. Not a diagnosis.
          </p>
        </SectionFrame>

        {/* ── 2 · A sample day ─────────────────────────────────────────────── */}
        <SampleDay />

        {/* ── 3 · How it works ─────────────────────────────────────────────── */}
        <SectionFrame id="how-it-works">
          <SectionHeading>How it works</SectionHeading>
          <ol className="mt-6">
            {[
              {
                title: "Set up in a few minutes.",
                body: "Install the app on your phone and your child's. Pair them with a short code. Choose a daily limit and a session length.",
                visual: (
                  <p className="tnum rounded-control border border-border bg-surface px-3 py-2 text-center font-mono text-body tracking-[0.3em] text-text" aria-label="Sample pairing code">
                    3 9 2 7 4 1
                  </p>
                ),
              },
              {
                title: "Sessions with a calm check.",
                body: "Your child starts a session. On their phone, the app reads their expression and turns it into an estimated Calm Index.",
                visual: (
                  <span className="inline-flex items-center gap-2">
                    <OrbMark size={36} state="calm" />
                    <StatusChip kind="calm" />
                  </span>
                ),
              },
              {
                title: "You see the answer first.",
                body: "The dashboard opens on one sentence: how they are doing and how long is left. The detail is one scroll away.",
                visual: (
                  <p className="font-display text-h3 font-semibold text-text" style={{ textWrap: "balance" }}>
                    Aarav is doing okay. 22 min left.
                  </p>
                ),
              },
            ].map((step, i) => (
              <li key={step.title} className={cn("grid gap-4 py-6 sm:grid-cols-[64px_minmax(0,1fr)_160px]", i > 0 && "border-t border-border")}>
                <span aria-hidden className="tnum font-display text-[2.5rem] font-semibold leading-none text-text">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-h3 font-semibold text-text">{step.title}</h3>
                  <p className="mt-1 max-w-[56ch] text-secondary">{step.body}</p>
                </div>
                <div className="flex items-start sm:justify-end">{step.visual}</div>
              </li>
            ))}
          </ol>
        </SectionFrame>

        {/* ── 4 · Controls you keep ────────────────────────────────────────── */}
        <SectionFrame>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="min-w-0">
              <SectionHeading>You stay in charge.</SectionHeading>
              <p className="mt-3 max-w-[52ch] text-secondary">
                Everything the dashboard can do is listed here. Nothing happens silently, and
                destructive actions ask first.
              </p>
            </div>
            <dl className="min-w-0">
              {CONTROLS.map((row) => (
                <div key={row.action} className="ledger-row">
                  <dt className="ledger-label text-secondary">{row.action}</dt>
                  <dd className="ledger-rule" aria-hidden />
                  <dd className="ledger-value max-w-[60%] whitespace-normal text-right font-sans text-caption font-normal leading-5 text-text-muted">
                    {row.outcome}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </SectionFrame>

        {/* ── 5 · What we do not do (the one band) ─────────────────────────── */}
        <section className="scroll-mt-20 bg-surface-2">
          <div className="mx-auto max-w-[1240px] px-4 py-[clamp(56px,9vw,128px)] md:px-8">
            <div className="mx-auto max-w-[900px] min-w-0">
              <SectionHeading>What we do not do</SectionHeading>
              <dl className="mt-6 grid gap-x-10 gap-y-4 md:grid-cols-2">
                {NOT_DO.map((row) => (
                  <div key={row.we} className="border-t border-[var(--rule-strong)] pt-3">
                    <dt className="text-secondary font-medium">{row.we}</dt>
                    <dd className="mt-0.5 text-secondary text-text-muted">{row.because}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* ── 6 · What the child sees ──────────────────────────────────────── */}
        <SectionFrame>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="min-w-0">
              <SectionHeading>A calmer phone for them, too.</SectionHeading>
              <p className="mt-3 max-w-[52ch] text-secondary">
                Your child sees a simple timer, and after a tense stretch the phone starts a
                short breather — a pause, not a punishment. By default they never see a score
                or a label about themselves; you can turn mood labels on if you prefer.
              </p>
            </div>
            <div className="min-w-0 border-l-2 border-[var(--rule)] pl-4 text-secondary">
              <p>
                The child app is built to be boring in the best way: big remaining time, one
                button to start, and honest wording. No feed, no streaks, no blame.
              </p>
            </div>
          </div>
        </SectionFrame>

        {/* ── 7 · Honest about estimates ───────────────────────────────────── */}
        <SectionFrame id="privacy">
          <SectionHeading>What the Calm Index is, and isn't.</SectionHeading>
          <div className="mt-6 max-w-[70ch]">
            <div className="border-t border-border py-4">
              <h3 className="font-display text-h3 font-semibold text-text">What it is.</h3>
              <p className="mt-1 text-secondary">
                An estimate from facial expressions, summarised as Calm, Neutral or Stressed.
              </p>
            </div>
            <div className="border-t border-border py-4">
              <h3 className="font-display text-h3 font-semibold text-text">What it isn't.</h3>
              <p className="mt-1 text-secondary">
                Not a medical or psychological assessment. Expressions vary between people,
                lighting and cameras.
              </p>
            </div>
            <div className="border-t border-border py-4">
              <h3 className="font-display text-h3 font-semibold text-text">What we do about that.</h3>
              <p className="mt-1 text-secondary">
                We label every reading as an estimate, show gaps as gaps, and compare a child
                only to their own recent days — never to other children.
              </p>
            </div>
          </div>
          <p className="mt-4">
            <a href="/privacy" className="inline-flex min-h-11 items-center px-2 text-secondary underline underline-offset-4 hover:text-text lg:min-h-6">
              Read the privacy details
            </a>
          </p>
        </SectionFrame>

        {/* ── 8 · Questions ────────────────────────────────────────────────── */}
        <SectionFrame id="questions">
          <SectionHeading>Questions</SectionHeading>
          <div className="mt-6 max-w-[70ch]">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-t border-border">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-body font-medium text-text [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden className="text-h3 font-normal text-text-subtle transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="pb-4 text-secondary">{item.a}</p>
              </details>
            ))}
          </div>
        </SectionFrame>

        {/* ── 9 · Closing CTA ──────────────────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="mx-auto flex max-w-[1240px] flex-col items-center px-4 py-[clamp(64px,10vw,144px)] text-center md:px-8">
            <OrbMark size={96} state="calm" breathe={!reduced} />
            <h2 className="mt-6 font-display text-h2 font-semibold text-text" style={{ textWrap: "balance" }}>
              Start with one calm day.
            </h2>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <a
                href="/download"
                className="inline-flex min-h-12 items-center whitespace-nowrap rounded-control bg-primary px-5 font-medium text-on-primary hover:bg-primary-hover"
              >
                Get the app
              </a>
              <a href="/login" className="inline-flex min-h-12 items-center px-2 text-secondary underline underline-offset-4 hover:text-text">
                Sign in
              </a>
            </div>
            <p className="mt-4 text-caption text-text-subtle">Android 13+ · No paid tier</p>
          </div>
        </section>

        {/* JSON-LD mirrors the visible FAQ exactly (spec §9.2); served same-origin */}
        <script type="application/ld+json" src="/home-faq.ld.json" />
      </div>
    </HomeLayout>
  );
}
