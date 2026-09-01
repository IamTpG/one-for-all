"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { triggerFetchNowAction } from "../actions/cron";
import styles from "../SettingsControls.module.css";

export default function FetchNowButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const res = await triggerFetchNowAction();
      if (!res.ok) {
        setResult("Couldn't fetch — try again.");
        return;
      }
      setResult(`Fetched ${res.fetched} items.`);
      router.refresh();
    });
  }

  return (
    <div className={styles.settingsGroup}>
      <button type="button" className={styles.saveButton} onClick={handleClick} disabled={pending}>
        {pending ? "Fetching…" : "Fetch now"}
      </button>
      {result && <p className={styles.saveConfirmed}>{result}</p>}
    </div>
  );
}
