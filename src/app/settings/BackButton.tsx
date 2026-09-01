"use client";

import { useRouter } from "next/navigation";
import styles from "./Settings.module.css";

export default function BackButton() {
  const router = useRouter();

  function handleClick() {
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
