"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GearIcon } from "@/lib/icons";
import { setDisabledFeedsCookie } from "@/lib/cookies";
import type { SettingsGroup } from "@/lib/types";
import styles from "./AppShell.module.css";

export default function FeedSettings({
  groups,
  disabledFeeds,
}: {
  groups: SettingsGroup[];
  disabledFeeds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState<Set<string>>(() => new Set(disabledFeeds));
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

  function toggle(sourceId: string) {
    const next = new Set(disabled);
    if (next.has(sourceId)) next.delete(sourceId);
    else next.add(sourceId);
    setDisabled(next);
    setDisabledFeedsCookie(Array.from(next));
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
        </div>
      )}
    </div>
  );
}
