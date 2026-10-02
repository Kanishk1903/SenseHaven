import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PinInput } from "@/components/PinInput";
import { useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "@/lib/api";
import { useChildren, useMe } from "@/lib/queries";
import { handleApiError } from "@/lib/handleApiError";

const STEPS = ["Add your child", "Set your device PIN", "Pair the phone"];

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data: children } = useChildren();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (children !== undefined && children.length > 0 && step === 0) setStep(1);
    if (me?.has_pin && step === 1) setStep(2);
  }, [children, me, step]);

  return (
    <main className="mx-auto max-w-[600px] px-4 py-10">
      <h1 className="font-display text-h1 font-semibold text-text">Set up SenseHeaven</h1>
      <ol className="mt-4 hidden items-center text-caption sm:flex" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex items-center">
            {index > 0 ? <span aria-hidden className="mx-2 h-px w-8 bg-border-strong" /> : null}
            <span
              className={`flex items-center gap-1.5 rounded-pill px-2.5 py-1 ${
                index === step
                  ? "bg-primary-soft font-medium text-primary"
                  : index < step
                    ? "text-calm-fg"
                    : "text-text-subtle"
              }`}
              aria-current={index === step ? "step" : undefined}
            >
              <span className="tnum">{index + 1}</span> {label}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 sm:hidden">
        <p className="text-secondary text-text-muted" aria-current="step">
          Step {step + 1} of {STEPS.length} &middot; {STEPS[step]}
        </p>
        <div className="mt-1.5 h-1 rounded-pill bg-surface-2" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
          <div className="h-1 rounded-pill bg-primary" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <div className="mt-6">
        {step === 0 ? (
          <StepAddChild
            onDone={() => {
              void queryClient.invalidateQueries({ queryKey: ["children"] });
              setStep(1);
            }}
          />
        ) : null}
        {step === 1 ? <StepSetPin onDone={() => setStep(2)} /> : null}
        {step === 2 ? <StepPair onDone={() => navigate("/")} /> : null}
      </div>
    </main>
  );
}

function StepAddChild({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [avatar, setAvatar] = useState("orb-1");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () =>
      api.post("/children", {
        name,
        birth_year: birthYear ? Number(birthYear) : undefined,
        avatar_key: avatar,
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who are we looking after?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block text-secondary">
          Child's name
          <Input className="mt-1" value={name} autoFocus onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block text-secondary">
          Birth year (optional)
          <Input
            className="mt-1 tnum"
            inputMode="numeric"
            value={birthYear}
            onChange={(event) => setBirthYear(event.target.value)}
          />
        </label>
        <fieldset>
          <legend className="text-secondary">Pick an avatar</legend>
          <div className="mt-2 flex gap-2">
            {Array.from({ length: 8 }, (_, index) => `orb-${index + 1}`).map((key) => (
              <button
                key={key}
                type="button"
                aria-label={`Avatar ${key}`}
                aria-pressed={avatar === key}
                onClick={() => setAvatar(key)}
                className={`h-9 w-9 rounded-pill border-2 ${avatar === key ? "border-primary" : "border-transparent"}`}
                style={{ background: `hsl(${(Number(key.slice(-1)) * 42) % 360} 45% 72%)` }}
              />
            ))}
          </div>
        </fieldset>
        {error ? (
          <div role="alert" className="rounded-control bg-stress-soft px-3 py-2 text-secondary text-stress-fg">
            {error}
          </div>
        ) : null}
        <Button
          className="w-full"
          disabled={name.trim().length === 0 || create.isPending}
          onClick={async () => {
            try {
              await create.mutateAsync();
              onDone();
            } catch (caught) {
              setError(await handleApiError(caught, false));
            }
          }}
        >
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}

function StepSetPin({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set your device PIN</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-secondary text-text-muted">
          This 6-digit PIN unlocks your child's phone when a limit hits. You'll also use it to approve changes on
          the phone. Enter it twice.
        </p>
        {!pin ? (
          <PinInput onComplete={setPin} />
        ) : confirmed ? (
          <div className="space-y-3">
            <label className="block text-secondary">
              Your account password (to authorise the PIN)
              <Input
                className="mt-1"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error ? (
              <div role="alert" className="rounded-control bg-stress-soft px-3 py-2 text-secondary text-stress-fg">
                {error}
              </div>
            ) : null}
            <Button
              className="w-full"
              disabled={password.length === 0}
              onClick={async () => {
                try {
                  await api.put("/parents/me/pin", { password, pin });
                  onDone();
                } catch (caught) {
                  setError(await handleApiError(caught, false));
                }
              }}
            >
              Save PIN
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-secondary">Now enter it again to confirm.</p>
            <PinInput
              onComplete={(second) => {
                if (second === pin) setConfirmed(true);
                else {
                  setError("The two PINs didn't match. Try again.");
                  setPin(null);
                }
              }}
            />
            {error ? <p role="alert" className="text-center text-caption text-stress-fg">{error}</p> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StepPair({ onDone }: { onDone: () => void }) {
  const { data: children } = useChildren();
  const child = children?.[0];
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const devicePoll = useQuery<{ id: string; name: string; last_seen_at: string | null }[]>({
    queryKey: ["devices", child?.id],
    queryFn: () => api.get(`/children/${child!.id}/devices`),
    enabled: Boolean(child?.id) && code !== null,
    refetchInterval: 3_000,
  });
  const pairedDevice = devicePoll.data?.[0];

  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const issue = useMutation({
    mutationFn: async () => {
      const response = await api.post<{ code: string; expires_at: string }>(
        `/children/${child!.id}/pairing-code`,
      );
      setCode(response.code);
      setExpiresAt(response.expires_at);
      setError(null);
    },
  });

  useEffect(() => {
    if (child && code === null) void issue.mutateAsync().catch(async (caught) => {
      const message = caught instanceof ApiError ? caught.message : "Something went wrong. Try again.";
      if (caught instanceof ApiError && caught.code === "PIN_REQUIRED") {
        setError("Set your device PIN first — use the back button in this wizard.");
      } else {
        setError(message);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child, code]);

  useEffect(() => {
    if (pairedDevice) {
      const timer = setTimeout(onDone, 1200);
      return () => clearTimeout(timer);
    }
  }, [pairedDevice, onDone]);

  if (!child) return <p className="text-secondary">Add a child first.</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pair {child.name}'s phone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {code ? (
          <>
            <p className="text-center text-secondary text-text-muted">
              Enter this code in the SenseHeaven app on the phone. It lasts 10 minutes.
            </p>
            <div
              className="flex items-center justify-center gap-3"
              role="img"
              aria-label={`Pairing code ${code}`}
            >
              {[code.slice(0, 3), code.slice(3)].map((group, gi) => (
                <div key={gi} className="flex gap-2">
                  {group.split("").map((digit, di) => (
                    <span
                      key={di}
                      className="tnum flex h-14 w-11 items-center justify-center rounded-control border border-border bg-surface-2 text-[2rem] font-bold text-text"
                    >
                      {digit}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <p className="tnum text-center text-caption text-text-subtle">
              {secondsLeft > 0 ? `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : "Expired"}
            </p>
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCode(null);
                  void issue.mutateAsync();
                }}
              >
                Generate new code
              </Button>
            </div>
            <div className="rounded-card border border-border bg-surface-2 p-3 text-secondary">
              <p className="font-medium">Installing the app</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-secondary text-text-muted">
                <li>Download the APK from the Download page on the phone.</li>
                <li>Allow "Install from this source" when Android asks.</li>
                <li>Open SenseHeaven and enter the code above.</li>
                <li>If "restricted settings" appears: About phone → tap Build number 7×, then allow it in the app's App info.</li>
              </ol>
            </div>
            {pairedDevice ? (
              <div role="status" className="rounded-control bg-calm-soft px-3 py-2 text-center text-secondary text-calm-fg">
                {pairedDevice.name} is connected — finishing up…
              </div>
            ) : (
              <p className="text-center text-caption text-text-subtle" role="status">
                Waiting for the phone… (this page updates by itself)
              </p>
            )}
          </>
        ) : error ? (
          <div role="alert" className="rounded-control bg-stress-soft px-3 py-2 text-secondary text-stress-fg">
            {error}
          </div>
        ) : (
          <p className="text-center text-secondary">Generating a code…</p>
        )}
      </CardContent>
    </Card>
  );
}
