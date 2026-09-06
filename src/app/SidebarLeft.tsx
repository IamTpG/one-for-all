import { TOPICS } from "@/lib/config";
import type { ActiveFilter, SourceType } from "@/lib/types";
import styles from "./AppShell.module.css";

const CATEGORIES: { label: string; value: SourceType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Blogs", value: "rss" },
  { label: "Hacker News", value: "hn" },
  { label: "GitHub Trending", value: "github-trending" },
  { label: "Releases", value: "github-release" },
];

export type SidebarCounts = {
  byType: Record<string, number>;
  byTopic: Record<string, number>;
  bySource: Record<string, number>;
};

export default function SidebarLeft({
  feeds,
  activeFilter,
  onSelect,
  counts,
}: {
  feeds: { name: string; sourceId: string }[];
  activeFilter: ActiveFilter;
  onSelect: (filter: ActiveFilter) => void;
  counts: SidebarCounts;
}) {
  return (
    <aside className={styles.sidebarLeft}>
      <nav className={styles.navSection}>
        <div className={`${styles.navTitle} mono`}>Sources</div>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            className={styles.navLink}
            type="button"
            aria-pressed={activeFilter.kind === "type" && activeFilter.value === cat.value}
            onClick={() => onSelect({ kind: "type", value: cat.value })}
          >
            <span>{cat.label}</span>
            <span className={styles.navCount}>{counts.byType[cat.value] ?? 0}</span>
          </button>
        ))}
      </nav>
      <nav className={styles.navSection}>
        <div className={`${styles.navTitle} mono`}>Topics</div>
        {TOPICS.map((topic) => (
          <button
            key={topic.id}
            className={styles.navLink}
            type="button"
            aria-pressed={activeFilter.kind === "topic" && activeFilter.value === topic.id}
            onClick={() => onSelect({ kind: "topic", value: topic.id })}
          >
            <span>{topic.label}</span>
            <span className={styles.navCount}>{counts.byTopic[topic.id] ?? 0}</span>
          </button>
        ))}
      </nav>
      {feeds.length > 0 && (
        <nav className={styles.navSection}>
          <div className={`${styles.navTitle} mono`}>Feeds</div>
          {feeds.map((feed) => (
            <button
              key={feed.sourceId}
              className={styles.navLink}
              type="button"
              aria-pressed={activeFilter.kind === "source" && activeFilter.value === feed.sourceId}
              onClick={() => onSelect({ kind: "source", value: feed.sourceId })}
            >
              <span>{feed.name}</span>
              <span className={styles.navCount}>{counts.bySource[feed.sourceId] ?? 0}</span>
            </button>
          ))}
        </nav>
      )}
    </aside>
  );
}
