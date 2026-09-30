import { Navigate, Route, Routes } from "react-router-dom";

import { NotFoundPage } from "@/features/misc/NotFoundPage";

/** Route-level code splitting lands with each feature slice; shell wiring lives here. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
