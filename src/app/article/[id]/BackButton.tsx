"use client";

import { useRouter } from "next/navigation";
import styles from "./Article.module.css";

export default function BackButton() {
  const router = useRouter();

  function handleClick() {
    // router.back() reuses the browser's back/forward cache (preserving
    // scroll position and the feed's loaded-item count); a plain <Link
    // href="/"> would instead push a fresh navigation and refetch the
    // fully-dynamic home page from scratch, losing both. Fall back to a
    // normal navigation only if there's nowhere to go back to (e.g. the
    // article was opened directly, with no prior history entry).
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <button type="button" onClick={handleClick} className={styles.backLink}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.backIcon}>
        <path d="M15 18 L9 12 L15 6" />
      </svg>
      <span className="mono">Wire</span>
    </button>
  );
}
