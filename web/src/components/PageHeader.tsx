/** Page header pattern: H1, one-line description, primary action on the right (File 02 §3). */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-h1 font-semibold text-text">{title}</h1>
        {description ? <p className="mt-1 text-secondary text-text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </header>
  );
}
