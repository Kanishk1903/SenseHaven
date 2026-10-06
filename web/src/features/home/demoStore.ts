/** External store shared by the demo islands (spec §4.2): one tiny observable so the
 *  switcher, headline and panel islands — separate React roots — stay in sync. */
import { useSyncExternalStore } from "react";
import type { DemoStateName } from "@/features/home/data";

export type DemoStore = { state: DemoStateName; auto: boolean };

let store: DemoStore = { state: "live-calm", auto: true };
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setDemoState(state: DemoStateName) {
  store = { ...store, state };
  emit();
}

export function setDemoAuto(auto: boolean) {
  store = { ...store, auto };
  emit();
}

export function getDemoStore(): DemoStore {
  return store;
}

export function useDemoStore(): DemoStore {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    getDemoStore,
    getDemoStore,
  );
}
