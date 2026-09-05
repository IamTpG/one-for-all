import styles from "./Dashboard.module.css";

type Props = {
  label: string;
  value: number;
  total: number;
  displayText?: string;
  // "severity" turns the fill red when value < total (e.g. a source failed);
  // "neutral" (default) always uses the accent — for plain progress, not health.
  variant?: "neutral" | "severity";
};

export default function Meter({ label, value, total, displayText, variant = "neutral" }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const isShortfall = variant === "severity" && total > 0 && value < total;

  return (
    <div className={styles.meter}>
      <div className={styles.meterHeader}>
        <span className={styles.meterLabel}>{label}</span>
        <span className={styles.meterValue}>{displayText ?? `${pct}%`}</span>
      </div>
      <div className={styles.meterTrack}>
        <div
          className={`${styles.meterFill} ${isShortfall ? styles.meterFillCritical : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
