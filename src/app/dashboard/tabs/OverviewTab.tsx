import { GROQ_LIMITS, UPSTASH_LIMITS } from "@/lib/config";
import { formatBytes } from "@/lib/chartUtils";
import {
  loadBacklogSize,
  loadGroqUsage,
  loadHomeViews,
  loadRuns,
  loadSettings,
  loadStoredItems,
  loadTickStats,
  loadTicks,
  loadToggleStats,
  loadUpstashUsage,
} from "@/lib/dashboardData";
import { formatAgo, formatDuration, formatMinutes, formatTs } from "@/lib/format";
import { nextScheduledSlot, utcToIct } from "@/lib/schedule";
import styles from "../Dashboard.module.css";
import Meter from "../Meter";

const n = (value: number) => value.toLocaleString("en-US");

// The at-a-glance tab: the numbers worth a daily look. Charts, tables and
// history live in the other tabs.
export default async function OverviewTab() {
  const [settings, runs, ticks, tickStats, items, backlog, groq, upstash, homeViews, toggles] = await Promise.all([
    loadSettings(),
    loadRuns(),
    loadTicks(),
    loadTickStats(),
    loadStoredItems(),
    loadBacklogSize(),
    loadGroqUsage(),
    loadUpstashUsage(),
    loadHomeViews(),
    loadToggleStats(),
  ]);

  const nextDue = nextScheduledSlot(new Date(), settings.fetchTimesUtc);
  const latestRun = runs[0] ?? null;
  const lastTick = ticks[0] ?? null;
  const longestTickMs = ticks.reduce((max, tick) => Math.max(max, tick.durationMs), 0);
  // items is sorted newest-first by publish date.
  const newestItem = items[0] ?? null;
  const sourcesOk = latestRun?.sources.filter((source) => source.ok).length ?? 0;
  const sourcesTotal = latestRun?.sources.length ?? 0;
  const translated = Math.max(0, items.length - backlog);

  return (
    <>
      <section className={styles.section}>
        <h2 className={`${styles.sectionTitle} mono`}>Cron / Fetch Health</h2>
        <div className={styles.statGrid}>
          <div className={styles.statTile}>
            <span className={styles.statValue}>{nextDue ? `${utcToIct(nextDue.slotUtc)} ICT` : "—"}</span>
            <span className={styles.statLabel}>
              Next fetch {nextDue ? `in ${formatMinutes(nextDue.minutesUntil)}` : "not scheduled"}
            </span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>{latestRun ? formatTs(latestRun.ts) : "never"}</span>
            <span className={styles.statLabel}>Last run</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>{latestRun ? latestRun.totalFetched : "—"}</span>
            <span className={styles.statLabel}>
              Items fetched {latestRun ? `in ${formatDuration(latestRun.durationMs)}` : ""}
            </span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>{latestRun?.newItems === undefined ? "—" : latestRun.newItems}</span>
            <span className={styles.statLabel}>New items in last run</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>
              {newestItem ? formatAgo(new Date(newestItem.publishedAt).getTime()) : "—"}
            </span>
            <span className={styles.statLabel}>Newest item published</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>{lastTick ? formatAgo(lastTick.ts) : "never"}</span>
            <span className={styles.statLabel}>Last cron tick</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>
              {tickStats.ticksToday} / {tickStats.expectedSoFar}
            </span>
            <span className={styles.statLabel}>Ticks today (UTC) / expected so far</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>{ticks.length > 0 ? formatDuration(longestTickMs) : "—"}</span>
            <span className={styles.statLabel}>Longest of last {ticks.length} ticks (limit 60s)</span>
          </div>
        </div>

        {latestRun && (
          <Meter
            label="Latest run — sources succeeded"
            value={sourcesOk}
            total={sourcesTotal}
            displayText={`${sourcesOk} / ${sourcesTotal}`}
            variant="severity"
          />
        )}
      </section>

      <section className={styles.section}>
        <h2 className={`${styles.sectionTitle} mono`}>Translation</h2>
        <div className={styles.statGrid}>
          <div className={styles.statTile}>
            <span className={styles.statValue}>{backlog}</span>
            <span className={styles.statLabel}>Items awaiting translation</span>
          </div>
        </div>
        <Meter
          label="Items translated"
          value={translated}
          total={items.length}
          displayText={`${translated} / ${items.length}`}
        />
      </section>

      <section className={styles.section}>
        <h2 className={`${styles.sectionTitle} mono`}>Limits</h2>
        <Meter
          label="Groq tokens today (UTC)"
          value={groq.today.tokens}
          total={GROQ_LIMITS.tokensPerDay}
          displayText={`${n(groq.today.tokens)} / ${n(GROQ_LIMITS.tokensPerDay)}`}
        />
        <Meter
          label="Groq requests today (UTC)"
          value={groq.today.requests}
          total={GROQ_LIMITS.requestsPerDay}
          displayText={`${n(groq.today.requests)} / ${n(GROQ_LIMITS.requestsPerDay)}`}
        />
        {upstash.status === "ok" && (
          <>
            <Meter
              label="Upstash bandwidth this month"
              value={upstash.data.bandwidth.monthBytes}
              total={UPSTASH_LIMITS.bandwidthBytesPerMonth}
              displayText={`${formatBytes(upstash.data.bandwidth.monthBytes)} / ${formatBytes(UPSTASH_LIMITS.bandwidthBytesPerMonth)}`}
            />
            <Meter
              label="Upstash data size"
              value={upstash.data.dataSize.currentBytes}
              total={UPSTASH_LIMITS.dataSizeBytes}
              displayText={`${formatBytes(upstash.data.dataSize.currentBytes)} / ${formatBytes(UPSTASH_LIMITS.dataSizeBytes)}`}
            />
          </>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={`${styles.sectionTitle} mono`}>Page Views</h2>
        <div className={styles.statGrid}>
          <div className={styles.statTile}>
            <span className={styles.statValue}>{homeViews.total}</span>
            <span className={styles.statLabel}>Home views (total)</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>{homeViews.today}</span>
            <span className={styles.statLabel}>Home views (today)</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>
              {toggles.en} / {toggles.vi}
            </span>
            <span className={styles.statLabel}>EN / VI toggles</span>
          </div>
        </div>
      </section>
    </>
  );
}
