/* eslint-disable react-refresh/only-export-components -- a context module necessarily exports its provider and hook */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { useChildren, type Child } from "@/lib/queries";

type Selection = { child?: Child; select: (childId: string) => void };

const ChildSelectionContext = createContext<Selection>({ select: () => {} });

/** Selected child lives in React state (seeded from sessionStorage) so the UI updates instantly. */
export function ChildSelectionProvider({ children: kids }: { children: ReactNode }) {
  const { data } = useChildren();
  const [selectedId, setSelectedId] = useState<string | null>(() => sessionStorage.getItem("sh:child"));

  useEffect(() => {
    if (selectedId) sessionStorage.setItem("sh:child", selectedId);
  }, [selectedId]);

  const child = data?.find((candidate) => candidate.id === selectedId) ?? data?.[0];
  return (
    <ChildSelectionContext.Provider value={{ child, select: setSelectedId }}>
      {kids}
    </ChildSelectionContext.Provider>
  );
}

export function useChild(): Selection {
  return useContext(ChildSelectionContext);
}
