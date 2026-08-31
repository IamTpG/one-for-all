import type { FeedItem } from "@/lib/types";
import styles from "./AppShell.module.css";

function WidgetRow({ item, value }: { item: FeedItem; value: string }) {
  return (
    <a
      className={styles.widgetRow}
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className={styles.widgetLabel}>{item.title}</span>
      <span className={`${styles.widgetValue} mono`}>{value}</span>
    </a>
  );
}

export default function SidebarRight({
  trendingRepos,
  topHn,
}: {
  trendingRepos: FeedItem[];
  topHn: FeedItem[];
}) {
  if (trendingRepos.length === 0 && topHn.length === 0) return null;

  return (
    <aside className={styles.sidebarRight}>
      {trendingRepos.length > 0 && (
        <div className={styles.widget}>
          <div className={`${styles.widgetTitle} mono`}>Trending repos</div>
          {trendingRepos.map((item) => (
            <WidgetRow key={item.id} item={item} value={item.points ? String(item.points) : ""} />
          ))}
        </div>
      )}
      {topHn.length > 0 && (
        <div className={styles.widget}>
          <div className={`${styles.widgetTitle} mono`}>Top on HN</div>
          {topHn.map((item) => (
            <WidgetRow key={item.id} item={item} value={item.points ? String(item.points) : ""} />
          ))}
        </div>
      )}
    </aside>
  );
}
