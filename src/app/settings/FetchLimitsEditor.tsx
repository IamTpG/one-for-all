"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { setRetentionDaysAction, setSourceLimitsAction, type Retention, type SourceLimits } from "../actions/settings";
import styles from "../SettingsControls.module.css";

const FIELDS: { key: keyof SourceLimits; label: string }[] = [
  { key: "rssItemLimit", label: "RSS items per feed" },
  { key: "hnItemLimit", label: "Hacker News top stories" },
  { key: "githubTrendingLimit", label: "GitHub Trending repos" },
  { key: "releasesPerRepo", label: "Releases per watched repo" },
  { key: "officialItemLimit", label: "Official items per source" },
  { key: "officialLookbackDays", label: "Official lookback (days)" },
];

// Lowering a retention drops stored items for good: a source may no longer
// list them, so they cannot be fetched back.
const RETENTION_FIELDS: { key: keyof Retention; label: string; hint?: string }[] = [
  { key: "retentionDays", label: "Retention (days)" },
  {
    key: "officialRetentionDays",
    label: "Official retention (days)",
    hint: "Lowering this deletes stored official items older than that; they cannot be fetched back.",
  },
];

export default function FetchLimitsEditor({
  initialLimits,
  initialRetention,
}: {
  initialLimits: SourceLimits;
  initialRetention: Retention;
}) {
  const router = useRouter();
  const [limits, setLimits] = useState(initialLimits);
  const [retention, setRetention] = useState(initialRetention);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  function updateLimit(key: keyof SourceLimits, value: string) {
    const num = Number(value);
    setLimits((prev) => ({ ...prev, [key]: Number.isFinite(num) && num > 0 ? num : prev[key] }));
    setSaved(false);
  }

  function updateRetention(key: keyof Retention, value: string) {
    const num = Number(value);
    setRetention((prev) => ({ ...prev, [key]: Number.isFinite(num) && num > 0 ? num : prev[key] }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(false);
    const [limitsResult, retentionResult] = await Promise.all([
      setSourceLimitsAction(limits),
      setRetentionDaysAction(retention),
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
      {RETENTION_FIELDS.map((field) => (
        <Fragment key={field.key}>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>{field.label}</span>
            <input
              type="number"
              min={1}
              className={styles.fieldInput}
              value={retention[field.key]}
              aria-describedby={field.hint ? `${field.key}-hint` : undefined}
              onChange={(e) => updateRetention(field.key, e.target.value)}
            />
          </div>
          {field.hint && (
            <p id={`${field.key}-hint`} className={styles.hint}>
              {field.hint}
            </p>
          )}
        </Fragment>
      ))}
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
