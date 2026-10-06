/** Privacy (public, /privacy) — specific, not boilerplate: what is read, what is stored,
 *  where processing happens, retention and deletion. Every line traces to the product
 *  (see verification/home/report.md claims audit). */
import { useEffect } from "react";

import { HomeLayout } from "@/features/home/HomeLayout";

const ROWS: { what: string; detail: string }[] = [
  {
    what: "What is read",
    detail:
      "The child app reads facial-geometry landmarks from the camera during a session and computes a Calm Index on the device. Photos and video never leave the phone.",
  },
  {
    what: "What is stored",
    detail:
      "Only derived data syncs to the server: Calm Index readings with timestamps, screen sessions, daily app-usage totals, rule events (breathers, penalties), and alerts. Account data is the parent's name, email and timezone, plus the child's name and birth year.",
  },
  {
    what: "Where processing happens",
    detail:
      "Expression processing happens entirely on your child's phone. The server never sees a frame — it receives the computed index.",
  },
  {
    what: "Who can see it",
    detail:
      "The parent dashboard is on the parent's account. The child app shows no score or mood label about them by default; parents can switch mood labels on.",
  },
  {
    what: "How long it is kept",
    detail:
      "Readings are kept until you delete them. Settings has a danger zone: deleting a child removes everything collected about them — readings, sessions, app usage and alerts — while keeping the child and device entry.",
  },
  {
    what: "Third parties",
    detail:
      "There are no trackers, no ad networks, no analytics and no data sales anywhere in the product.",
  },
  {
    what: "Consent and children's data",
    detail:
      "This product processes data about children derived from faces. Before real-world use, confirm the lawful basis and verifiable parental consent requirements that apply to you (for India, the DPDP Act 2023 and its rules; elsewhere, equivalents such as COPPA/GDPR-K). This page is not legal advice.",
  },
];

export function PrivacyPage() {
  useEffect(() => {
    document.title = "Privacy — SenseHeaven";
  }, []);
  return (
    <HomeLayout>
      <main data-testid="privacy-ready">
        <section className="mx-auto max-w-[1240px] px-4 pb-[clamp(40px,6vw,80px)] pt-[clamp(32px,5vw,64px)] md:px-8">
          <h1 className="font-display font-normal text-text" style={{ fontSize: "clamp(2rem, 1.4rem + 2.6vw, 3.25rem)", lineHeight: 1.1, letterSpacing: "-0.015em" }}>
            Privacy, specifically.
          </h1>
          <p className="mt-4 max-w-[60ch] text-[1.125rem]/7 text-secondary">
            A product that reads faces owes you a straight answer about data. Here is exactly
            what is read, what is stored, and how it is removed.
          </p>
        </section>
        <section className="mx-auto max-w-[1240px] px-4 pb-[clamp(56px,9vw,128px)] md:px-8">
          <dl>
            {ROWS.map((row) => (
              <div key={row.what} className="border-t border-border py-5">
                <dt className="font-display text-h3 font-semibold text-text">{row.what}</dt>
                <dd className="mt-1 max-w-[70ch] text-secondary">{row.detail}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-caption text-text-subtle">
            Questions about this page: open an issue on the project repository.
          </p>
        </section>
      </main>
    </HomeLayout>
  );
}
