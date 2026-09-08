import type { FeedItem } from "@/lib/types";
import styles from "./AppShell.module.css";

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days < 1 ? "today" : `${days}d ago`;
}

function TrendingRow({ item }: { item: FeedItem }) {
  return (
    <a className={styles.trendRepoRow} href={item.url} target="_blank" rel="noopener noreferrer">
      <span className={`${styles.trendRepoName} mono`}>{item.title}</span>
      <span className={`${styles.trendRepoMeta} mono`}>
        {item.points !== undefined && `★ ${item.points.toLocaleString()} · `}
        created {daysAgo(item.publishedAt)}
      </span>
    </a>
  );
}

function HnRow({ item }: { item: FeedItem }) {
  return (
    <a className={styles.widgetRow} href={item.url} target="_blank" rel="noopener noreferrer">
      <span className={styles.widgetLabel}>{item.title}</span>
      <span className={styles.widgetValue}>{item.points ?? ""}</span>
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
          <div className={`${styles.widgetTitle} mono`}>GitHub Trending</div>
          {trendingRepos.map((item) => (
            <TrendingRow key={item.id} item={item} />
          ))}
        </div>
      )}
      {topHn.length > 0 && (
        <div className={styles.widget}>
          <div className={`${styles.widgetTitle} mono`}>Top on HN</div>
          {topHn.map((item) => (
            <HnRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </aside>
  );
}
