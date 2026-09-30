import { OrbMark } from "@/components/OrbMark";

type Props = {
  title: string;
  body: string;
  action?: React.ReactNode;
};

/** Shared empty/404 presentation: orb illustration + reason + next action (File 02 §3.8). */
export function EmptyState({ title, body, action }: Props) {
  return (
    <div className="flex max-w-sm flex-col items-center gap-4 text-center">
      <OrbMark size={72} mood="calm" />
      <div>
        <h1 className="text-h3 font-semibold">{title}</h1>
        <p className="mt-1 text-secondary text-text-muted">{body}</p>
      </div>
      {action}
    </div>
  );
}
