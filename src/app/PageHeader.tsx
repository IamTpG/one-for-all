"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./AppShell.module.css";

// Every page except home (whose header this visually matches exactly,
// reusing the same AppShell.module.css classes) and owner-login (no
// header at all). The brand block replaces the old separate "back" link —
// clicking it goes back, styled identically to home's non-interactive
// brand mark + "OneForAll" + tagline.
export default function PageHeader({
  tagline,
  actions,
}: {
  tagline: string;
  actions?: ReactNode;
}) {
  const router = useRouter();

  function handleClick() {
    // Reuses the browser's back/forward cache when possible (preserving
    // scroll position and the home feed's loaded-item count) instead of a
    // fresh navigation; falls back to a normal push if there's nowhere to
    // go back to (e.g. this page was opened directly, with no history).
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarInner}>
        <button type="button" onClick={handleClick} className={styles.brandButton} aria-label="Back to OneForAll">
          <svg className={styles.backChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18 L9 12 L15 6" />
          </svg>
          <svg className={styles.brandMark} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 17 L4 9" />
            <path d="M9 17 L9 5" />
            <path d="M14 17 L14 12" />
            <path d="M19 17 L19 7" />
          </svg>
          <span className={styles.brandText}>
            <span className={`${styles.brandTitle} display`}>OneForAll</span>
            <span className={`${styles.brandTagline} mono`}>{tagline}</span>
          </span>
        </button>
        {actions && <div className={styles.headerRight}>{actions}</div>}
      </div>
    </header>
  );
}
