/* eslint-disable react-refresh/only-export-components -- context module exports provider + hook */
/** Theme system (spec §3): System / Light / Dark, stored in localStorage, applied as
 *  data-theme on <html> by the no-flash script in index.html. React side syncs OS changes
 *  when preference = system and exposes the segmented toggle. */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePref = "system" | "light" | "dark";

const STORAGE_KEY = "sh-theme";

function apply(pref: ThemePref) {
  const dark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themePref = pref;
}

function readPref(): ThemePref {
  const stored = localStorage.getItem(STORAGE_KEY) as ThemePref | null;
  return stored === "light" || stored === "dark" ? stored : "system";
}

const ThemeContext = createContext<{ pref: ThemePref; setPref: (p: ThemePref) => void }>({
  pref: "system",
  setPref: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref);

  useEffect(() => {
    apply(pref);
    localStorage.setItem(STORAGE_KEY, pref);
  }, [pref]);

  useEffect(() => {
    if (pref !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [pref]);

  return <ThemeContext.Provider value={{ pref, setPref: setPrefState }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
