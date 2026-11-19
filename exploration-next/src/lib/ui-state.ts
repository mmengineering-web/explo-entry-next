"use client";
import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";
type Density = "comfortable" | "compact";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => { setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"); }, []);
  const toggle = useCallback(() => {
    const next: Theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("exp_theme", next); } catch {}
    setTheme(next);
  }, []);
  return { theme, toggle };
}

export function useDensity() {
  const [density, setDensity] = useState<Density>("comfortable");
  useEffect(() => { setDensity(document.documentElement.dataset.density === "compact" ? "compact" : "comfortable"); }, []);
  const toggle = useCallback(() => {
    const next: Density = document.documentElement.dataset.density === "compact" ? "comfortable" : "compact";
    document.documentElement.dataset.density = next;
    try { localStorage.setItem("exp_density", next); } catch {}
    setDensity(next);
  }, []);
  return { density, toggle };
}
