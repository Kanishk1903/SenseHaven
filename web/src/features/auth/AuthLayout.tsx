import { BrandMark } from "@/components/BrandMark";

/** Split auth layout: form (max 400px) left, brand panel right (hidden < 900px). */
export function AuthLayout({ children, heading }: { children: React.ReactNode; heading: string }) {
  return (
    <div className="flex min-h-screen">
      <main className="flex w-full flex-col justify-center px-6 py-10 lg:w-[480px] lg:px-12">
        <div className="mx-auto w-full max-w-[400px]">
          <a href="/" className="mb-8 inline-flex min-h-11 items-center gap-2" aria-label="SenseHeaven home">
            <BrandMark size={28} />
            <span className="font-display font-semibold text-text">SenseHeaven</span>
          </a>
          <h1 className="font-display text-h1 font-semibold text-text">{heading}</h1>
          {children}
        </div>
      </main>
      <aside
        aria-hidden
        className="relative hidden flex-1 flex-col justify-end overflow-hidden bg-surface-2 p-12 lg:flex" data-scroll-x="decorative"
      >
        <div className="absolute right-[-10%] top-[-15%] h-[520px] w-[520px] rounded-full bg-calm-soft" />
        <div className="relative space-y-4">
          <BrandMark size={56} />
          <p className="text-h2 font-semibold">Calm technology for families</p>
          <ul className="max-w-md space-y-2 text-secondary text-text-muted">
            <li>Screen time that adapts to how your child is doing — bonuses for calm stretches.</li>
            <li>Nothing is stored on the phone: no photos, no recordings, only a wellbeing score.</li>
            <li>You stay in control with clear limits, gentle breaks and honest data.</li>
          </ul>
          <p className="max-w-md text-caption text-text-subtle">
            Facial-expression estimates are approximate and are not a medical or psychological assessment.
          </p>
        </div>
      </aside>
    </div>
  );
}
