import type { ActiveFilter, SourceType } from "@/lib/types";
import styles from "./AppShell.module.css";

const CATEGORIES: { label: string; value: SourceType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Blogs", value: "rss" },
  { label: "Hacker News", value: "hn" },
  { label: "GitHub Trending", value: "github-trending" },
  { label: "Releases", value: "github-release" },
];

export default function SidebarLeft({
  feeds,
  activeFilter,
  onSelect,
}: {
  feeds: { name: string; sourceId: string }[];
  activeFilter: ActiveFilter;
  onSelect: (filter: ActiveFilter) => void;
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
            {cat.label}
          </button>
        ))}
      </nav>
      {feeds.length > 0 && (
        <nav className={`${styles.navSection} ${styles.navSectionScroll}`}>
          <div className={`${styles.navTitle} mono`}>Feeds</div>
          {feeds.map((feed) => (
            <button
              key={feed.sourceId}
              className={styles.navLink}
              type="button"
              aria-pressed={activeFilter.kind === "source" && activeFilter.value === feed.sourceId}
              onClick={() => onSelect({ kind: "source", value: feed.sourceId })}
            >
              {feed.name}
            </button>
          ))}
        </nav>
      )}
    </aside>
  );
}
