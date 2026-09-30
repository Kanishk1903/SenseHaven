import { BellOff, CheckCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonCard } from "@/components/Skeleton";
import { useAlerts, useAlertsMutations, type AlertRow } from "@/features/apiHooks";
import { cn } from "@/lib/cn";

type Filter = "all" | "unread" | "critical";

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
}

export function AlertsPage() {
  const alerts = useAlerts();
  const { markRead, markAllRead } = useAlertsMutations();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = (alerts.data ?? []).filter((alert) =>
    filter === "unread" ? alert.read_at === null : filter === "critical" ? alert.severity === "critical" : true,
  );
  const grouped = filtered.reduce<Record<string, AlertRow[]>>((acc, alert) => {
    const key = dayLabel(alert.created_at);
    (acc[key] ??= []).push(alert);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Alerts"
        description="What happened, in plain words."
        action={
          <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            <CheckCheck size={16} aria-hidden /> Mark all read
          </Button>
        }
      />
      <div className="mb-4 flex gap-2">
        {(["all", "unread", "critical"] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={filter === option ? "primary" : "outline"}
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
          >
            {option === "all" ? "All" : option === "unread" ? "Unread" : "Critical"}
          </Button>
        ))}
      </div>

      {alerts.isLoading ? (
        <SkeletonCard lines={6} />
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <EmptyState
            title="Nothing to report"
            body="Alerts appear when a long stressful stretch starts a breather, or when the phone loses a permission."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, rows]) => (
            <section key={day} aria-label={day}>
              <h2 className="mb-2 text-caption font-medium text-text-subtle">{day}</h2>
              <ul className="space-y-2">
                {rows.map((alert) => (
                  <li key={alert.id}>
                    <Card className={cn(!alert.read_at && "border-primary/40")}>
                      <CardContent className="flex items-start gap-3 p-4">
                        <span
                          aria-hidden
                          className={cn(
                            "mt-1.5 h-2 w-2 shrink-0 rounded-pill",
                            alert.severity === "critical" ? "bg-stress" : alert.read_at ? "bg-border" : "bg-primary",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-secondary font-medium">
                            {alert.title}
                            {!alert.read_at ? (
                              <span className="ml-2 rounded-pill bg-primary-soft px-1.5 py-0.5 text-caption font-medium text-primary">
                                New
                              </span>
                            ) : null}
                          </p>
                          <p className="text-secondary text-text-muted">{alert.body}</p>
                          <p className="mt-0.5 text-caption text-text-subtle">
                            {new Date(alert.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        {alert.read_at === null ? (
                          <Button size="sm" variant="ghost" onClick={() => markRead.mutate(alert.id)}>
                            Mark read
                          </Button>
                        ) : null}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {!alerts.isLoading && (alerts.data?.length ?? 0) === 0 ? (
        <p className="mt-6 flex items-center justify-center gap-1.5 text-caption text-text-subtle">
          <BellOff size={12} aria-hidden /> You'll only hear from SenseHeaven when it matters.
        </p>
      ) : null}
    </div>
  );
}
