/** Shared react-query helpers (keys, auth state, children list). */
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";

export type Parent = {
  id: string;
  email: string;
  display_name: string;
  timezone: string;
  has_pin: boolean;
  created_at: string;
};

export type Child = {
  id: string;
  name: string;
  birth_year: number | null;
  avatar_key: string;
  settings: Record<string, unknown>;
  created_at: string;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<Parent>("/auth/me"),
    retry: false,
    staleTime: 60_000,
  });
}

export function useChildren() {
  return useQuery({
    queryKey: ["children"],
    queryFn: () => api.get<Child[]>("/children"),
    staleTime: 30_000,
  });
}

export function useSelectedChild(children: Child[] | undefined) {
  // one child per parent in the common case; remember the last pick per session
  const stored = sessionStorage.getItem("sh:child");
  if (children === undefined || children.length === 0) return undefined;
  return children.find((child) => child.id === stored) ?? children[0];
}

export function selectChild(childId: string) {
  sessionStorage.setItem("sh:child", childId);
}

export function useLogout() {
  const queryClient = useQueryClient();
  return async () => {
    await api.post("/auth/logout");
    queryClient.clear();
    sessionStorage.removeItem("sh:child");
  };
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
