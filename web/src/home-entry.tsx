/** Entry for the prerendered public home (home.html): no router, no data layer. */
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import "@fontsource-variable/fraunces";
import "@fontsource-variable/instrument-sans";
import "./styles/index.css";
import { ThemeProvider } from "./app/theme";
import { HomePage } from "./features/home/HomePage";

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <ThemeProvider>
      <HomePage />
    </ThemeProvider>
  </StrictMode>
);

// the served home.html is prerendered: hydrate it (no repaint of the prerendered markup);
// a truly empty root (dev server) mounts fresh
if (root.childNodes.length > 0) {
  hydrateRoot(root, app);
} else {
  createRoot(root).render(app);
}
