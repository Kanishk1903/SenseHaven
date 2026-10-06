/** Islands entry for the prerendered public Home: mounts small interactive React roots
 *  into placeholders in the static markup. The surrounding page is server-rendered and
 *  never React-managed — the LCP paint is immune to hydration and bundle parsing. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles/index.css";
import { ThemeProvider } from "./app/theme";
import { ThemeToggle } from "./components/ThemeToggle";
import { DemoControls, DemoHeadline, DemoPanel, SampleRibbon } from "./features/home/DemoIslands";
import { MenuIsland } from "./features/home/MenuIsland";
import { SAMPLE_DAY, SAMPLE_NOTES } from "./features/home/data";

const ISLANDS: [string, React.ReactElement][] = [
  ["demo-headline", <DemoHeadline />],
  ["demo-panel", <DemoPanel />],
  ["demo-controls", <DemoControls />],
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

for (const [id, el] of ISLANDS) {
  const node = document.getElementById(id);
  if (!node) continue;
  createRoot(node).render(
    <StrictMode>
      <ThemeProvider>{el}</ThemeProvider>
    </StrictMode>,
  );
}
