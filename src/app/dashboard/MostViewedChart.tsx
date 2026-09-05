import styles from "./Dashboard.module.css";

type Item = { id: string; title: string; count: number };

export default function MostViewedChart({ items }: { items: Item[] }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((item) => item.count));

  return (
    <div className={styles.barChart}>
      {items.map((item) => (
        <div key={item.id} className={styles.barRow} title={`${item.title}: ${item.count} views`}>
          <span className={styles.barLabel}>{item.title}</span>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <span className={styles.barValue}>{item.count}</span>
        </div>
      ))}
    </div>
  );
}
