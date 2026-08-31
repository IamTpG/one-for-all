"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "./actions/owner";
import { setDisabledFeedsAction } from "./actions/settings";
import { GearIcon } from "@/lib/icons";
import type { SettingsGroup } from "@/lib/types";
import styles from "./AppShell.module.css";
import WatchedReposEditor from "./WatchedReposEditor";

export default function FeedSettings({
  groups,
  disabledFeeds,
  watchedRepos,
}: {
  groups: SettingsGroup[];
  disabledFeeds: string[];
  watchedRepos: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState<Set<string>>(() => new Set(disabledFeeds));
  const [error, setError] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

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
    <div className={styles.settingsWrap} ref={panelRef}>
      <button
        className={styles.themeToggle}
        type="button"
        aria-label="Feed settings"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <GearIcon />
      </button>
      {open && (
        <div className={styles.settingsPanel}>
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
          <WatchedReposEditor initialRepos={watchedRepos} />
          <form action={logoutAction} className={styles.settingsGroup}>
            <button type="submit" className={styles.signOutButton}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
