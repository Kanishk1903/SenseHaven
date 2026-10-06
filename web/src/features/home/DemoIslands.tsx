/** Interactive demo islands (spec §4.2): mounted by islands-entry into the prerendered
 *  placeholders. The static markup around them is never React-managed, so the LCP paint
 *  is immune to hydration and bundle parsing. */
import { lazy, Suspense, useEffect, useRef, useState } from "react";

const DayRibbon = lazy(() => import("@/components/charts/DayRibbon").then((m) => ({ default: m.DayRibbon })));

import { NowPanelView } from "@/components/now/NowPanelView";
import { statusSentence } from "@/components/now/status";
import { DEMO_STATES, type DemoStateName } from "@/features/home/data";
import { getDemoStore, setDemoAuto, setDemoState, useDemoStore } from "@/features/home/demoStore";
import { cn } from "@/lib/cn";
import type { RibbonBucket, RibbonMarker, SessionBracket } from "@/components/charts/DayRibbon";

const STATES: DemoStateName[] = ["live-calm", "live-neutral", "live-stressed"];
const STATE_LABELS: Record<DemoStateName, string> = {
  "live-calm": "Calm",
  "live-neutral": "Neutral",
  "live-stressed": "Stressed",
};

// eslint-disable-next-line react-refresh/only-export-components -- media-query hook shared by the islands
export function usePrefersReducedMotion(): boolean {
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

/** headline above the panel — announces state changes politely */
export function DemoHeadline() {
  const { state, auto } = useDemoStore();
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (reduced || !auto) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const next = STATES[(STATES.indexOf(getDemoStore().state) + 1) % STATES.length]!;
      setDemoState(next);
    }, 7000);
    return () => clearInterval(timer);
  }, [reduced, auto]);

  const live = DEMO_STATES[state];
  const headline = statusSentence(live, "Aarav", state === "live-stressed" ? "2026-10-02T14:42:00+05:30" : null);
  return (
    <p className="mb-2 text-caption text-text-subtle" role="status">
      {headline.h1}
    </p>
  );
}

/** the Now panel itself — switches with the store */
export function DemoPanel() {
  const { state } = useDemoStore();
  return <NowPanelView state={DEMO_STATES[state]} />;
}

/** the state switcher + pause control */
export function DemoControls() {
  const { state, auto } = useDemoStore();
  return (
    <div
      className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
      onFocus={() => setDemoAuto(false)}
      onBlur={() => setDemoAuto(true)}
      onPointerEnter={() => setDemoAuto(false)}
      onPointerLeave={() => setDemoAuto(true)}
    >
      <div role="radiogroup" aria-label="Demo state" className="flex flex-wrap items-center gap-0.5 rounded-control bg-surface-3 p-0.5">
        {STATES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={state === s}
            onClick={() => setDemoState(s)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-[7px] px-3 text-secondary lg:min-h-6",
              state === s ? "bg-surface text-text shadow-elev1" : "hover:text-text",
            )}
          >
            {STATE_LABELS[s]}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={!auto}
        onClick={() => setDemoAuto(!auto)}
        className="inline-flex min-h-11 items-center px-2 text-caption text-text-muted hover:text-text lg:min-h-6"
      >
        {auto ? "Pause demo" : "Play demo"}
      </button>
    </div>
  );
}

/** the sample-day ribbon island: mounts when scrolled into view (spec §9.1) */
export function SampleRibbon({ buckets, episodes, sessions, noteMarkers }: {
  buckets: RibbonBucket[];
  episodes: RibbonMarker[];
  sessions: SessionBracket[];
  noteMarkers: { at: number; label: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setVisible(true);
        io.disconnect();
      }
    });
    io.observe(el);
    // idle fallback: full-page captures and non-scrolling visitors still get the ribbon
    const idle = (window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1200)))((() => {
      setVisible(true);
      io.disconnect();
    }) as IdleRequestCallback);
    return () => {
      io.disconnect();
      if (window.cancelIdleCallback && typeof idle === "number") window.cancelIdleCallback(idle);
    };
  }, []);
  return (
    <div ref={ref}>
      {visible ? <SampleRibbonInner buckets={buckets} episodes={episodes} sessions={sessions} noteMarkers={noteMarkers} /> : <div className="h-[96px] rounded-[6px] bg-surface-2" aria-hidden />}
    </div>
  );
}

function SampleRibbonInner({ buckets, episodes, sessions, noteMarkers }: {
  buckets: RibbonBucket[];
  episodes: RibbonMarker[];
  sessions: SessionBracket[];
  noteMarkers: { at: number; label: string }[];
}) {
  return (
    <Suspense fallback={<div className="h-[96px] rounded-[6px] bg-surface-2" aria-hidden />}>
      <DayRibbon
        buckets={buckets}
        episodes={episodes}
        sessions={sessions}
        showNow={false}
        autoZoom={false}
        noteMarkers={noteMarkers}
        ariaLabel="A sample day's Calm Index ribbon"
      />
    </Suspense>
  );
}
