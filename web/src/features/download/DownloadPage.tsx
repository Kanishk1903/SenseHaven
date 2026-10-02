import { Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { api } from "@/lib/api";

type ApkInfo = { version: string; url: string; sha256: string; size: number };

export function DownloadPage() {
  const apk = useQuery({
    queryKey: ["apk"],
    queryFn: () => api.get<ApkInfo>("/apk.json").catch(() => fetch("/apk.json").then((response) => response.json() as Promise<ApkInfo>)),
    staleTime: 60_000,
  });

  return (
    <div className="max-w-[640px]">
      <PageHeader
        title="Download for Android"
        description="Install SenseHeaven on your child's phone."
      />
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>SenseHeaven child app</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {apk.data ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="text-secondary">
                  <p className="font-medium">Version {apk.data.version}</p>
                  <p className="tnum text-caption text-text-subtle">
                    {(apk.data.size / 1024 / 1024).toFixed(1)} MB · SHA-256 {apk.data.sha256.slice(0, 16)}…
                  </p>
                </div>
                <a
                  href={apk.data.url}
                  className="inline-flex h-10 items-center gap-2 rounded-control bg-primary px-4 font-medium text-on-primary hover:bg-primary-hover"
                  download
                >
                  <Download size={16} aria-hidden /> Download APK
                </a>
              </div>
              <details className="rounded-card border border-border p-3 text-secondary">
                <summary className="cursor-pointer font-medium">Install steps (Android 13+)</summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-secondary text-text-muted">
                  <li>Open this page on your child's phone and tap Download APK.</li>
                  <li>When Play Protect warns, choose "Install anyway" — the app is debug-signed for this school project.</li>
                  <li>Open SenseHeaven, accept the consent screen, and enter the pairing code.</li>
                  <li>Grant the four permissions the setup wizard asks for: Camera, Notifications, Usage access, Display over other apps.</li>
                </ol>
              </details>
              <details className="rounded-card border border-border p-3 text-secondary">
                <summary className="cursor-pointer font-medium">Troubleshooting</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-secondary text-text-muted">
                  <li><strong>Install blocked:</strong> Settings → Apps → Special access → Install unknown apps → allow your browser.</li>
                  <li><strong>App closes overnight:</strong> battery optimisation — allow "Unrestricted" in App info → Battery.</li>
                  <li><strong>Pairing code expired:</strong> codes last 10 minutes — generate a new one on the Overview.</li>
                </ul>
              </details>
            </>
          ) : (
            <p className="text-secondary text-text-muted">
              The APK link appears here once the first release is built (Phase 7 publishes it automatically).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
