"use client";

import { useRouter } from "next/navigation";
import { LANGUAGE_COOKIE } from "@/lib/language";
import { useLanguage } from "./LanguageProvider";
import styles from "./AppShell.module.css";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export default function LanguageToggle() {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();

  function toggle() {
    const next = language === "vi" ? "en" : "vi";
    // Instant — cards flip immediately, no round trip, since both
    // languages are already present in the data they were rendered with.
    setLanguage(next);
    document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_SECONDS}`;
    // Re-runs the server tree so an already-open article's body picks up
    // its (server-side, cookie-gated) translation.
    router.refresh();
  }

  return (
    <button
      className={styles.themeToggle}
      type="button"
      onClick={toggle}
      aria-pressed={language === "vi"}
      aria-label={language === "vi" ? "Switch to English" : "Switch to Vietnamese"}
    >
      <span className="mono">{language === "vi" ? "VI" : "EN"}</span>
    </button>
  );
}
