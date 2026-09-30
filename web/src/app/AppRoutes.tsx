import { Route, Routes } from "react-router-dom";

import { RequireAuth, Shell } from "./Shell";
import { AccountPage } from "@/features/account/AccountPage";
import { AlertsPage } from "@/features/alerts/AlertsPage";
import { AnalyticsPage } from "@/features/analytics/AnalyticsPage";
import { DownloadPage } from "@/features/download/DownloadPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { NotFoundPage } from "@/features/misc/NotFoundPage";
import { OnboardingPage } from "@/features/onboarding/OnboardingPage";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<Shell />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/download" element={<DownloadPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/children/:childId/analytics" element={<AnalyticsPage />} />
          <Route path="/children/:childId/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
