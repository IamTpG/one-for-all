"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ictToUtc, utcToIct } from "@/lib/schedule";
import { setFetchTimesAction } from "../actions/settings";
import styles from "../SettingsControls.module.css";

export default function ScheduleEditor({ initialTimesUtc }: { initialTimesUtc: string[] }) {
  const router = useRouter();
  const [timesIct, setTimesIct] = useState<string[]>(() => initialTimesUtc.map(utcToIct));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  function updateTime(index: number, value: string) {
    setTimesIct((prev) => prev.map((t, i) => (i === index ? value : t)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(false);
    const result = await setFetchTimesAction(timesIct.map(ictToUtc));
    setSaving(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className={styles.settingsGroup}>
      <p className={styles.hint}>Times below are in Vietnam time (UTC+7).</p>
      {timesIct.map((time, index) => (
        <div key={index} className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Fetch #{index + 1}</span>
          <input
            type="time"
            className={`${styles.fieldInput} ${styles.timeInput}`}
            value={time}
            onChange={(e) => updateTime(index, e.target.value)}
          />
        </div>
      ))}
      {error && <p className={styles.settingsError}>Couldn&apos;t save — try again.</p>}
      {saved && !error && (
        <p className={styles.saveConfirmed}>Saved — takes effect on the next tick.</p>
      )}
      <button type="button" className={styles.saveButton} onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
