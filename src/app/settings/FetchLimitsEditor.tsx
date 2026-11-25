"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { LIMIT_MAX, parseLimitInput } from "@/lib/limits";
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

type Drafts = Record<string, string>;
type Notes = Record<string, { kind: "error" | "info"; text: string }>;

function toDrafts(values: Record<string, number>): Drafts {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)]));
}

export default function FetchLimitsEditor({
  initialLimits,
  initialRetention,
}: {
  initialLimits: SourceLimits;
  initialRetention: Retention;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Drafts>(() => toDrafts({ ...initialLimits, ...initialRetention }));
  const [notes, setNotes] = useState<Notes>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  function update(key: string, value: string) {
    setDrafts((prev) => ({ ...prev, [key]: value }));
    setNotes((prev) => {
      if (!prev[key]) return prev;
      const rest = { ...prev };
      delete rest[key];
      return rest;
    });
    setSaved(false);
  }

  async function save() {
    const next: Notes = {};
    const parsed: Record<string, number> = {};
    for (const { key } of [...FIELDS, ...RETENTION_FIELDS]) {
      const n = parseLimitInput(drafts[key] ?? "");
      if (n === null) next[key] = { kind: "error", text: "Enter a whole number of 1 or more." };
      else parsed[key] = n;
    }
    setError(false);
    setSaved(false);
    if (Object.values(next).some((note) => note.kind === "error")) {
      setNotes(next);
      return;
    }
    setSaving(true);
    // One after the other: both actions read-modify-write the same settings.
    const limitsResult = await setSourceLimitsAction(pick(parsed, FIELDS) as SourceLimits);
    const retentionResult = await setRetentionDaysAction(pick(parsed, RETENTION_FIELDS) as Retention);
    setSaving(false);
    if (!limitsResult.ok || !retentionResult.ok) {
      setError(true);
      return;
    }
    // Show what the server stored, and say where it differs from the input.
    const stored: Record<string, number> = { ...limitsResult.values, ...retentionResult.values };
    const issues: Record<string, string | undefined> = { ...limitsResult.issues, ...retentionResult.issues };
    for (const key of Object.keys(stored)) {
      if (issues[key] === "clamped") next[key] = { kind: "info", text: `Saved as ${stored[key]} (max)` };
      else if (issues[key] === "invalid") next[key] = { kind: "error", text: `Not saved, kept ${stored[key]}.` };
    }
    setDrafts(toDrafts(stored));
    setNotes(next);
    setSaved(true);
    router.refresh();
  }

  function row(field: { key: string; label: string; hint?: string }) {
    const note = notes[field.key];
    const hintId = field.hint ? `${field.key}-hint` : undefined;
    const noteId = note ? `${field.key}-note` : undefined;
    return (
      <Fragment key={field.key}>
        <div className={styles.fieldRow}>
          <label htmlFor={`limit-${field.key}`} className={styles.fieldLabel}>
            {field.label}
          </label>
          <input
            id={`limit-${field.key}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={LIMIT_MAX[field.key]}
            className={styles.fieldInput}
            value={drafts[field.key] ?? ""}
            aria-invalid={note?.kind === "error" || undefined}
            aria-describedby={[hintId, noteId].filter(Boolean).join(" ") || undefined}
            onChange={(e) => update(field.key, e.target.value)}
          />
        </div>
        {note && (
          <p
            id={noteId}
            role={note.kind === "error" ? "alert" : "status"}
            className={note.kind === "error" ? styles.settingsError : styles.saveConfirmed}
          >
            {note.text}
          </p>
        )}
        {field.hint && (
          <p id={hintId} className={styles.hint}>
            {field.hint}
          </p>
        )}
      </Fragment>
    );
  }

  return (
    <div className={styles.settingsGroup}>
      {FIELDS.map(row)}
      {RETENTION_FIELDS.map(row)}
      {error && <p className={styles.settingsError}>Couldn&apos;t save — try again.</p>}
      {saved && !error && <p className={styles.saveConfirmed}>Saved — takes effect on the next fetch.</p>}
      <button type="button" className={styles.saveButton} onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function pick(values: Record<string, number>, fields: { key: string }[]): Record<string, number> {
  return Object.fromEntries(fields.map(({ key }) => [key, values[key]]));
}
