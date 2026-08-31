"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@/lib/icons";
import styles from "./AppShell.module.css";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("wire-theme") as "light" | "dark" | null;
    // One-time read of browser-only state (localStorage/matchMedia) on mount;
    // can't be computed during SSR, so an effect is unavoidable here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(stored ?? (systemPrefersDark() ? "dark" : "light"));
  }, []);

  function toggle() {
    const next = (theme === "dark" ? "light" : "dark") as "light" | "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("wire-theme", next);
    } catch {
      // localStorage unavailable — theme just won't persist across reloads
    }
  }

  const isDark = theme === "dark";

  return (
    <button
      className={styles.themeToggle}
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
