"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setRetentionDaysAction, setSourceLimitsAction, type SourceLimits } from "../actions/settings";
import styles from "../SettingsControls.module.css";

const FIELDS: { key: keyof SourceLimits; label: string }[] = [
  { key: "rssItemLimit", label: "RSS items per feed" },
  { key: "hnItemLimit", label: "Hacker News top stories" },
  { key: "githubTrendingLimit", label: "GitHub Trending repos" },
  { key: "releasesPerRepo", label: "Releases per watched repo" },
  { key: "anthropicItemLimit", label: "Anthropic posts" },
];

export default function FetchLimitsEditor({
  initialLimits,
  initialRetentionDays,
}: {
  initialLimits: SourceLimits;
  initialRetentionDays: number;
}) {
  const router = useRouter();
  const [limits, setLimits] = useState(initialLimits);
  const [retentionDays, setRetentionDays] = useState(initialRetentionDays);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  function updateLimit(key: keyof SourceLimits, value: string) {
    const num = Number(value);
    setLimits((prev) => ({ ...prev, [key]: Number.isFinite(num) && num > 0 ? num : prev[key] }));
    setSaved(false);
  }

  function updateRetention(value: string) {
    const num = Number(value);
    setRetentionDays((prev) => (Number.isFinite(num) && num > 0 ? num : prev));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(false);
    const [limitsResult, retentionResult] = await Promise.all([
      setSourceLimitsAction(limits),
      setRetentionDaysAction(retentionDays),
    ]);
    setSaving(false);
    if (!limitsResult.ok || !retentionResult.ok) {
      setError(true);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className={styles.settingsGroup}>
      {FIELDS.map((field) => (
        <div key={field.key} className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{field.label}</span>
          <input
            type="number"
            min={1}
            className={styles.fieldInput}
            value={limits[field.key]}
            onChange={(e) => updateLimit(field.key, e.target.value)}
          />
        </div>
      ))}
      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>Retention (days)</span>
        <input
          type="number"
          min={1}
          className={styles.fieldInput}
          value={retentionDays}
          onChange={(e) => updateRetention(e.target.value)}
        />
      </div>
      {error && <p className={styles.settingsError}>Couldn&apos;t save — try again.</p>}
      {saved && !error && (
        <p className={styles.saveConfirmed}>Saved — takes effect on the next fetch.</p>
      )}
      <button type="button" className={styles.saveButton} onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
