import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonCard } from "@/components/Skeleton";
import { api } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { handleApiError } from "@/lib/handleApiError";
import { useChild } from "@/app/childSelection";
import { useChildren } from "@/lib/queries";

type Settings = {
  good_bonus_min: number;
  stress_penalty_min: number;
  cooldown_min: number;
  max_bonus_per_session_min: number;
  calm_threshold: number;
  stress_threshold: number;
  sustained_stress_s: number;
  sustained_calm_s: number;
  penalty_lockout_s: number;
  monitoring_enabled: boolean;
  activity_log_enabled: boolean;
  show_mood_to_child: boolean;
  blocked_packages: string[];
  allowed_packages: string[];
  config_version: number;
};

type DeviceRow = {
  id: string;
  name: string;
  android_version: string;
  app_version: string;
  paired_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  permissions: Record<string, unknown>;
};

const GRANT_LABELS: Record<string, string> = {
  camera: "Camera",
  notifications: "Notifications",
  usage_access: "Usage access",
  overlay: "Display over other apps",
  camera_ok: "Camera working",
};

function useChildSettings(childId: string | undefined) {
  return useQuery({
    queryKey: ["settings", childId],
    queryFn: () => api.get<Settings>(`/children/${childId}/settings`),
    enabled: Boolean(childId),
  });
}

export function SettingsPage() {
  const { child } = useChild();
  const navigate = useNavigate();
  const settings = useChildSettings(child?.id);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteHistoryOpen, setDeleteHistoryOpen] = useState(false);
  const [deleteChildOpen, setDeleteChildOpen] = useState(false);
  const children = useChildren();

  useEffect(() => {
    if (settings.data && draft === null) setDraft(structuredClone(settings.data));
  }, [settings.data, draft]);

  const patch = (changes: Partial<Settings>) =>
    setDraft((current) => (current ? { ...current, ...changes } : current));

  const save = useMutation({
    mutationFn: (next: Settings) => api.patch(`/children/${child!.id}/settings`, next),
    onSuccess: () => {
      void settings.refetch();
      setDraft(null);
    },
  });

  if (settings.isLoading || !draft) {
    return (
      <div>
        <PageHeader title="Settings" description="Loading…" />
        <SkeletonCard lines={8} />
      </div>
    );
  }
  if (settings.isError) {
    return <ErrorState message={settings.error.message} onRetry={() => void settings.refetch()} />;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.data);
  const saveBarVisible = dirty || save.isSuccess;

  return (
    <div>
      <PageHeader title={`${child?.name ?? "Child"} — settings`} description="Changes apply on the phone's next check-in." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Session defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-secondary text-text-muted">
              SenseHeaven uses explicit sessions (no all-day limit). Start one from the Overview or from the phone's
              parent menu; each start lets you pick 15 m, 30 m, 1 h, 2 h or a custom length up to 8 h.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rewards &amp; cooldown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <NumberField
              label="Bonus minutes for staying calm"
              value={draft.good_bonus_min}
              min={1}
              max={60}
              hint={`A full calm stretch adds ${formatDuration(draft.good_bonus_min * 60)} — up to ${formatDuration(draft.max_bonus_per_session_min * 60)} per session.`}
              onChange={(value) => patch({ good_bonus_min: value })}
            />
            <NumberField
              label="Penalty minutes for sustained stress"
              value={draft.stress_penalty_min}
              min={1}
              max={30}
              hint={`A long stressed stretch removes ${formatDuration(draft.stress_penalty_min * 60)} and starts a ${draft.cooldown_min}-minute breather (time isn't consumed).`}
              onChange={(value) => patch({ stress_penalty_min: value })}
            />
            <NumberField
              label="Cooldown minutes"
              value={draft.cooldown_min}
              min={1}
              max={15}
              hint="The breathing screen length after a penalty."
              onChange={(value) => patch({ cooldown_min: value })}
            />
            <NumberField
              label="Max bonus per session"
              value={draft.max_bonus_per_session_min}
              min={0}
              max={120}
              hint="Total bonus a single session can earn."
              onChange={(value) => patch({ max_bonus_per_session_min: value })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sensitivity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Slider
                aria-label="Calm and stress thresholds"
                min={5}
                max={95}
                step={1}
                value={[draft.stress_threshold, draft.calm_threshold]}
                onValueChange={([low, high]) => {
                  const stress = Math.min(low, high - 11);
                  patch({ stress_threshold: Math.max(5, stress), calm_threshold: high });
                }}
              />
              <p className="tnum mt-2 text-caption text-text-muted">
                Stressed below {draft.stress_threshold} · Calm from {draft.calm_threshold}
              </p>
              <div className="mt-1 flex h-3 overflow-hidden rounded-pill">
                <div className="bg-stress-soft" style={{ width: `${draft.stress_threshold}%` }} />
                <div className="bg-surface-2" style={{ width: `${draft.calm_threshold - draft.stress_threshold}%` }} />
                <div className="bg-calm-soft" style={{ width: `${100 - draft.calm_threshold}%` }} />
              </div>
            </div>
            <NumberField
              label="Sustained stress before a breather (minutes)"
              value={draft.sustained_stress_s / 60}
              min={1}
              max={15}
              hint={`Penalty fires after ${formatDuration(draft.sustained_stress_s)} of continuous stress signals.`}
              onChange={(value) => patch({ sustained_stress_s: value * 60 })}
            />
            <NumberField
              label="Sustained calm before a bonus (minutes)"
              value={draft.sustained_calm_s / 60}
              min={5}
              max={60}
              hint={`Bonus fires after ${formatDuration(draft.sustained_calm_s)} of continuous calm.`}
              onChange={(value) => patch({ sustained_calm_s: value * 60 })}
            />
            <NumberField
              label="Minutes between penalties"
              value={draft.penalty_lockout_s / 60}
              min={5}
              max={60}
              hint="Prevents penalty after penalty."
              onChange={(value) => patch({ penalty_lockout_s: value * 60 })}
            />
            <Button variant="ghost" size="sm" onClick={() => setDraft({ ...structuredClone(settings.data!) })}>
              Reset to recommended
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monitoring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Toggle
              label="Emotion monitoring"
              hint="The camera estimates a wellbeing score on the phone. No photos are ever saved or sent."
              checked={draft.monitoring_enabled}
              onChange={(value) => patch({ monitoring_enabled: value })}
            />
            <Toggle
              label="App usage log"
              hint="Daily totals of which apps were used, shown in Analytics."
              checked={draft.activity_log_enabled}
              onChange={(value) => patch({ activity_log_enabled: value })}
            />
            <Toggle
              label="Show mood to my child"
              hint="When off, the phone shows a neutral orb and never labels your child's mood."
              checked={draft.show_mood_to_child}
              onChange={(value) => patch({ show_mood_to_child: value })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Blocked apps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-secondary text-text-muted">
              Apps the phone has reported. Blocked apps can't be opened during a session; dialler and emergency
              calls are always allowed.
            </p>
            <BlockedPackages
              reported={["com.google.android.youtube", "com.instagram.android", "com.android.chrome"]}
              value={draft.blocked_packages}
              onChange={(value) => patch({ blocked_packages: value })}
            />
          </CardContent>
        </Card>

        <DeviceCard />

        <Card>
          <CardHeader>
            <CardTitle>Privacy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" onClick={() => setDeleteHistoryOpen(true)}>
              Delete history
            </Button>
            <Button variant="danger" onClick={() => setDeleteChildOpen(true)}>
              Delete child
            </Button>
          </CardContent>
        </Card>
      </div>

      <div
        className={`sticky bottom-4 mt-6 transition-opacity ${
          saveBarVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-card border border-border bg-surface p-3 shadow-md">
          <span className="text-secondary">{dirty ? "You have unsaved changes" : "All changes saved"}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDraft(structuredClone(settings.data!))} disabled={!dirty}>
              Discard
            </Button>
            <Button
              onClick={async () => {
                setSaving(true);
                try {
                  await save.mutateAsync(draft);
                } catch (error) {
                  await handleApiError(error);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={!dirty || saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteHistoryOpen}
        onOpenChange={setDeleteHistoryOpen}
        title="Delete history"
        description="Removes all collected sessions, calm data, app usage and alerts for this child. The pairing stays."
        confirmWord={child?.name ?? "DELETE"}
        confirmLabel="Delete history"
        onConfirm={async () => {
          try {
            await api.delete(`/children/${child!.id}/data`);
            await settings.refetch();
          } catch (error) {
            await handleApiError(error);
          }
        }}
      />
      <ConfirmDialog
        open={deleteChildOpen}
        onOpenChange={setDeleteChildOpen}
        title="Delete child"
        description="Removes this child and everything collected. The phone will show 'unpaired'."
        confirmWord={child?.name ?? "DELETE"}
        confirmLabel="Delete child"
        onConfirm={async () => {
          try {
            await api.delete(`/children/${child!.id}`);
            await children.refetch();
            navigate("/");
          } catch (error) {
            await handleApiError(error);
          }
        }}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  hint?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-secondary">
      {label}
      <Input
        className="mt-1 tnum w-28"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, Math.round(parsed))));
        }}
      />
      {hint ? <p className="mt-1 text-caption text-text-subtle">{hint}</p> : null}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block text-secondary font-medium">{label}</span>
        <span className="block text-caption text-text-subtle">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors ${checked ? "bg-calm" : "bg-surface-2 border border-border"}`}
      >
        <span
          aria-hidden
          className={`absolute top-0.5 h-5 w-5 rounded-pill bg-surface shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </label>
  );
}

function BlockedPackages({
  reported,
  value,
  onChange,
}: {
  reported: string[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const all = Array.from(new Set([...reported, ...value]));
  return (
    <ul className="space-y-2">
      {all.map((pkg) => {
        const blocked = value.includes(pkg);
        return (
          <li key={pkg} className="flex items-center justify-between gap-3">
            <span className="text-secondary">{pkg}</span>
            <Button
              size="sm"
              variant={blocked ? "danger" : "outline"}
              aria-pressed={blocked}
              onClick={() => onChange(blocked ? value.filter((candidate) => candidate !== pkg) : [...value, pkg])}
            >
              {blocked ? "Blocked" : "Block"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function DeviceCard() {
  const { child } = useChild();
  const devices = useQuery({
    queryKey: ["devices", child?.id],
    queryFn: () => api.get<DeviceRow[]>(`/children/${child!.id}/devices`),
    enabled: Boolean(child?.id),
  });
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const device = devices.data?.find((row) => row.revoked_at === null);

  if (devices.isLoading) return <SkeletonCard lines={4} />;
  if (!device) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Device</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-secondary text-text-muted">No phone paired yet — finish onboarding to pair one.</p>
        </CardContent>
      </Card>
    );
  }
  const permissions = Object.entries(device.permissions ?? {}).filter(([key]) => key !== "camera_ok");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Device</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-secondary">
          {device.name} · Android {device.android_version || "?"} · app {device.app_version || "?"}
        </p>
        <p className="text-caption text-text-subtle">
          Last seen {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "never"}
        </p>
        <ul className="space-y-1">
          {permissions.map(([grant, has]) => (
            <li key={grant} className="flex items-center justify-between text-secondary">
              {GRANT_LABELS[grant] ?? grant}
              <span
                className={`rounded-pill px-2 py-0.5 text-caption font-medium ${
                  has ? "bg-calm-soft text-calm-fg" : "bg-neutral-soft text-neutral-fg"
                }`}
              >
                {has ? "Granted" : "Needed"}
              </span>
            </li>
          ))}
        </ul>
        <Button variant="danger" onClick={() => setConfirmRevoke(device.id)}>
          Revoke device
        </Button>
        <ConfirmDialog
          open={confirmRevoke !== null}
          onOpenChange={(open) => setConfirmRevoke(open ? device.id : null)}
          title="Revoke device"
          description="The phone will wipe its pairing and show 'unpaired' at its next check-in."
          confirmWord={device.name}
          confirmLabel="Revoke"
          onConfirm={async () => {
            try {
              await api.delete(`/devices/${device.id}`);
              await devices.refetch();
            } catch (error) {
              await handleApiError(error);
            }
          }}
        />
      </CardContent>
    </Card>
  );
}
