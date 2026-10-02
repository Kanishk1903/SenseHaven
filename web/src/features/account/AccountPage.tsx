import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PinInput } from "@/components/PinInput";
import { PageHeader } from "@/components/PageHeader";
import { api } from "@/lib/api";
import { useMe } from "@/lib/queries";
import { handleApiError } from "@/lib/handleApiError";

export function AccountPage() {
  const { data: me } = useMe();
  const [pin, setPin] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const setPinMutation = useMutation({
    mutationFn: () => api.put("/parents/me/pin", { password, pin }),
    onSuccess: () => {
      setMessage("Device PIN updated.");
      setPin(null);
      setConfirmed(false);
      setPassword("");
    },
  });

  return (
    <div className="max-w-[600px]">
      <PageHeader title="Account" description="Your profile and the device PIN." />
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-secondary">
          <p>
            <span className="text-text-muted">Name:</span> {me?.display_name}
          </p>
          <p>
            <span className="text-text-muted">Email:</span> {me?.email}
          </p>
          <p>
            <span className="text-text-muted">Timezone:</span> {me?.timezone}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Device PIN</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-secondary text-text-muted">
            The 6-digit PIN that unlocks the phone and approves changes. Entering a new one replaces the old PIN on
            the phone's next check-in.
          </p>
          {!pin ? (
            <PinInput onComplete={setPin} />
          ) : confirmed ? (
            <div className="space-y-3">
              <label className="block text-secondary">
                Your account password
                <Input
                  className="mt-1"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              {message ? (
                <div role="status" className="rounded-control bg-calm-soft px-3 py-2 text-secondary text-calm-fg">
                  {message}
                </div>
              ) : null}
              <Button
                disabled={password.length === 0 || setPinMutation.isPending}
                onClick={async () => {
                  try {
                    await setPinMutation.mutateAsync();
                  } catch (error) {
                    setMessage(await handleApiError(error, false));
                  }
                }}
              >
                Save new PIN
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-secondary">Enter it again to confirm.</p>
              <PinInput
                onComplete={(second) => {
                  if (second === pin) setConfirmed(true);
                  else {
                    setMessage("The two PINs didn't match. Try again.");
                    setPin(null);
                  }
                }}
              />
            </div>
          )}
          {setPinMutation.isError ? (
            <div role="alert" className="rounded-control bg-stress-soft px-3 py-2 text-secondary text-stress-fg">
              {setPinMutation.error.message}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <p className="mt-6 text-caption text-text-subtle">
        Need to remove everything? Deleting your child and their data lives in{" "}
        <button type="button" className="inline-flex min-h-11 items-center px-1 underline lg:min-h-6" onClick={() => navigate("/")}>
          Settings → Privacy
        </button>
        .
      </p>
    </div>
  );
}
