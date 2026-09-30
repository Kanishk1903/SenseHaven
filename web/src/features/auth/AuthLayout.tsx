import { OrbMark } from "@/components/OrbMark";

/** Split auth layout: form (max 400px) left, brand panel right (hidden < 900px). */
export function AuthLayout({ children, heading }: { children: React.ReactNode; heading: string }) {
  return (
    <div className="flex min-h-screen">
      <main className="flex w-full flex-col justify-center px-6 py-10 lg:w-[480px] lg:px-12">
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-2">
            <OrbMark size={28} />
            <span className="font-semibold">SenseHeaven</span>
          </div>
          <h1 className="text-h1 font-semibold">{heading}</h1>
          {children}
        </div>
      </main>
      <aside
        aria-hidden
        className="relative hidden flex-1 flex-col justify-end overflow-hidden bg-surface-2 p-12 lg:flex"
      >
        <div className="absolute right-[-10%] top-[-15%] h-[520px] w-[520px] rounded-full bg-gradient-to-br from-calm-soft via-primary-soft to-surface-2" />
        <div className="relative space-y-4">
          <OrbMark size={56} mood="calm" />
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
