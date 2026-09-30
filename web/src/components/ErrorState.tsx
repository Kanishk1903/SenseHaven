import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Error card: what happened + what to do + Retry + copyable request id (File 02 §3.8). */
export function ErrorState({
  message,
  onRetry,
  requestId,
  title = "Something went wrong",
}: {
  message: string;
  onRetry?: () => void;
  requestId?: string | null;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div role="alert" className="rounded-card border border-border bg-surface p-4">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-secondary text-text-muted">{message}</p>
      <div className="mt-3 flex items-center gap-2">
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
        {requestId ? (
          <button
            type="button"
            className="text-caption text-text-subtle underline hover:text-text-muted"
            onClick={async () => {
              await navigator.clipboard.writeText(requestId);
              setCopied(true);
            }}
          >
            {copied ? "Request id copied" : `Copy request id ${requestId.slice(0, 6)}…`}
          </button>
        ) : null}
      </div>
    </div>
  );
}
