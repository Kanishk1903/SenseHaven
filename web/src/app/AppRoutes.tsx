import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

import { RequireAuth, Shell } from "./Shell";
import { HomePage } from "@/features/home/HomePage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { NotFoundPage } from "@/features/misc/NotFoundPage";
import { PrivacyPage } from "@/features/privacy/PrivacyPage";

// the authenticated dashboard is a separate chunk: the public Home must stay small
const AccountPage = lazy(() => import("@/features/account/AccountPage").then((m) => ({ default: m.AccountPage })));
const AlertsPage = lazy(() => import("@/features/alerts/AlertsPage").then((m) => ({ default: m.AlertsPage })));
const AnalyticsPage = lazy(() => import("@/features/analytics/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })));
const DownloadPage = lazy(() => import("@/features/download/DownloadPage").then((m) => ({ default: m.DownloadPage })));
const OnboardingPage = lazy(() => import("@/features/onboarding/OnboardingPage").then((m) => ({ default: m.OnboardingPage })));
const OverviewPage = lazy(() => import("@/features/overview/OverviewPage").then((m) => ({ default: m.OverviewPage })));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<Shell />}>
            <Route path="/app" element={<OverviewPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/download" element={<DownloadPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/children/:childId/analytics" element={<AnalyticsPage />} />
            <Route path="/children/:childId/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
