/** Mounts the demo islands into the placeholder divs. Called by islands-entry (prerendered
 *  home.html) and by HomePage itself (SPA fallback path) — both are safe: each placeholder
 *  is mounted exactly once (guarded by a data attribute). */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ThemeProvider } from "@/app/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MenuIsland } from "@/features/home/MenuIsland";
import { DemoNow, SampleRibbon } from "@/features/home/DemoIslands";
import { SAMPLE_DAY, SAMPLE_NOTES } from "@/features/home/data";

export function mountHomeIslands() {
  const mounts: [string, React.ReactElement][] = [
    ["demo-root", <DemoNow />],
    [
      "sample-ribbon",
      <SampleRibbon
        buckets={SAMPLE_DAY.buckets}
        episodes={SAMPLE_DAY.episodes}
        sessions={SAMPLE_DAY.sessions}
        noteMarkers={SAMPLE_NOTES.map((n, i) => ({ at: n.at, label: String(i + 1) }))}
      />,
    ],
    ["footer-theme", <ThemeToggle />],
    ["menu-island", <MenuIsland />],
  ];
  for (const [id, el] of mounts) {
    const node = document.getElementById(id);
    if (!node || node.dataset.islandMounted === "1") continue;
    node.dataset.islandMounted = "1";
    createRoot(node).render(<StrictMode><ThemeProvider>{el}</ThemeProvider></StrictMode>);
  }
}
