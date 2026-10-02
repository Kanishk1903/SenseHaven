import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "./app/theme";

import "@fontsource-variable/fraunces";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/jetbrains-mono";
import "./styles/index.css";
import { AppRoutes } from "./app/AppRoutes";
import { activeFixture, installFixtureGlobals } from "./lib/fixture";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // the dashboard polls; retry behaviour and stale times live with each query
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Fixture harness (spec 7): expose a refetch hook for the CLS check. No-op in production.
if (activeFixture()) installFixtureGlobals(queryClient);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster position="top-center" duration={4000} />
    </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
