/** NowPanelView — the pure presentational Now panel (spec 4.2): ring + orb, Calm Index row,
 *  remaining time, and the state captions. All state is derived from the `state` prop, so
 *  the Overview feeds it from the live API and the public Home demo feeds it from fixtures
 *  with inert actions — the same component, the same design, no fake mockups. */
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { OrbMark } from "@/components/OrbMark";
import { StatusChip, type StatusKind } from "@/components/StatusChip";
import type { LiveState } from "@/features/apiHooks";

export function NowPanelView({
  state,
  actions,
}: {
  state: LiveState;
  /** the state-driven action row; the demo passes inert buttons, Overview passes the wired ones */
  actions?: ReactNode;
}) {
  const offline = state.state === "offline";
  const active = state.state === "active";
  const lockedSession = state.state === "locked" && state.session !== null;
  const session = state.session;
  const fraction =
    session && session.granted_s + session.bonus_s > 0
      ? Math.max(0, Math.min(1, (state.remaining_s ?? 0) / (session.granted_s + session.bonus_s)))
      : 0;

  return (
    <section
      className="h-full rounded-panel border border-border bg-surface p-[clamp(12px,2.5vw,1.25rem)]"
      aria-label="Current status"
    >
      <p className="text-caption font-medium tracking-wide text-text-subtle">Now</p>
      {offline ? (
        <p className="mt-2 text-secondary text-text-muted">
          Limits still work offline. Anything you change here will apply when the phone reconnects.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center">
        {/* ring + orb (176px, orb 96px inside; time sits to the RIGHT, not inside) */}
        <div
          className={cn("relative shrink-0", offline && "opacity-90")}
          role="timer"
          aria-label={`${Math.max(0, Math.round((state.remaining_s ?? 0) / 60))} minutes left`}
        >
          <div className="relative flex h-[176px] w-[176px] items-center justify-center">
            <svg viewBox="0 0 176 176" className="absolute inset-0 -rotate-90">
              <circle
                cx="88" cy="88" r="83" fill="none"
                stroke={offline ? "var(--rule-strong)" : "var(--rule)"}
                strokeWidth="10"
                strokeDasharray={offline ? "4 6" : undefined}
              />
              {!offline ? (
                <circle
                  cx="88" cy="88" r="83" fill="none"
                  stroke={active && (state.remaining_s ?? 0) < 5 * 60 ? "var(--neutral)" : "var(--primary)"}
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 83}
                  strokeDashoffset={2 * Math.PI * 83 * (1 - fraction)}
                />
              ) : null}
            </svg>
            <OrbMark
              size={96}
              state={offline ? "offline" : state.calm_index?.label === "calm" ? "calm" : state.calm_index?.label === "stressed" ? "stressed" : "neutral"}
              breathe={active && state.calm_index?.label === "calm"}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {state.calm_index ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="tnum font-display text-[1.75rem] font-semibold leading-8 text-text" data-nowrap>
                {state.calm_index.value}
              </span>
              <span className="inline-flex items-center" data-nowrap>
                <StatusChip kind={state.calm_index.label as StatusKind} />
              </span>
              <span className="text-caption text-text-subtle">estimated from facial expressions</span>
            </div>
          ) : (
            <p className="mt-3 text-secondary text-text-muted">No calm readings yet this session.</p>
          )}

          {state.remaining_s !== null ? (
            <p className="mt-3">
              <span className="tnum inline-block font-display text-[2.5rem] font-semibold leading-none text-text" data-nowrap>
                {Math.floor(Math.max(0, state.remaining_s) / 60)}
                <span className="ml-1.5 inline-block align-baseline font-sans text-[1.375rem] font-normal text-text-muted">min</span>
              </span>
              <span className="ml-2 inline-block max-w-full text-secondary text-text-subtle">left in this session</span>
            </p>
          ) : null}
        </div>
      </div>

      {actions ? <div className="mt-5 flex flex-wrap items-center gap-2">{actions}</div> : null}
      {offline ? (
        <p className="mt-2 text-caption text-text-subtle">Locking applies when the phone reconnects; add-time is queued.</p>
      ) : null}
      {state.state === "cooldown" ? (
        <p className="mt-2 text-caption text-text-subtle">A breather is running; add-time resumes after it ends.</p>
      ) : null}
      {lockedSession ? (
        <p className="mt-2 text-caption text-text-subtle">A locked session can't be changed. Start a new session instead.</p>
      ) : null}
    </section>
  );
}
