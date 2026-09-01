"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SettingsGroup } from "@/lib/types";
import { setDisabledFeedsAction } from "../actions/settings";
import styles from "../SettingsControls.module.css";

export default function SourceToggles({
  groups,
  disabledFeeds,
}: {
  groups: SettingsGroup[];
  disabledFeeds: string[];
}) {
  const router = useRouter();
  const [disabled, setDisabled] = useState<Set<string>>(() => new Set(disabledFeeds));
  const [error, setError] = useState(false);

  async function toggle(sourceId: string) {
    const previous = disabled;
    const next = new Set(disabled);
    if (next.has(sourceId)) next.delete(sourceId);
    else next.add(sourceId);
    setDisabled(next);
    setError(false);

    const result = await setDisabledFeedsAction(Array.from(next));
    if (!result.ok) {
      setDisabled(previous);
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {groups.map((group) => (
        <div key={group.title} className={styles.settingsGroup}>
          <div className={`${styles.settingsPanelTitle} mono`}>{group.title}</div>
          {group.sources.map((source) => (
            <label key={source.sourceId} className={styles.settingsRow}>
              <span className={styles.settingsRowLabel}>{source.name}</span>
              <span className={styles.switch}>
                <input
                  type="checkbox"
                  checked={!disabled.has(source.sourceId)}
                  onChange={() => toggle(source.sourceId)}
                />
                <span className={styles.switchTrack} aria-hidden="true" />
              </span>
            </label>
          ))}
        </div>
      ))}
      {error && <p className={styles.settingsError}>Couldn&apos;t save — try again.</p>}
    </div>
  );
}
