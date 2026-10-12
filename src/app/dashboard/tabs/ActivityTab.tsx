import {
  loadBackfillHistory,
  loadGithubRateLimit,
  loadHomeViewsDaily,
  loadItemViewCounts,
  loadRecentFailures,
  loadRedisUp,
  loadRuns,
  loadSettings,
  loadStoredItems,
  loadTicks,
} from "@/lib/dashboardData";
import { formatDuration, formatTs } from "@/lib/format";
import { utcToIct } from "@/lib/schedule";
import Collapsible from "../Collapsible";
import styles from "../Dashboard.module.css";
import MostViewedChart from "../MostViewedChart";
import ViewsLineChart from "../ViewsLineChart";

// Lower-priority detail, one collapsible card each: failures (open), pipeline
// history, traffic, system.
export default async function ActivityTab() {
  const [settings, runs, ticks, backfill, recentFailures, items, itemViews, homeViewsDaily, redisUp, githubRate] =
    await Promise.all([
      loadSettings(),
      loadRuns(),
      loadTicks(),
      loadBackfillHistory(),
      loadRecentFailures(),
      loadStoredItems(),
      loadItemViewCounts(),
      loadHomeViewsDaily(),
      loadRedisUp(),
      loadGithubRateLimit(),
    ]);

  const latestRun = runs[0] ?? null;
  const lastRunPerSlot = settings.fetchTimesUtc.map((slotUtc) => ({
    slotUtc,
    run: runs.find((run) => run.slot === slotUtc) ?? null,
  }));

  const titleById = new Map(items.map((item) => [item.id, item.title]));
  const mostViewed = Array.from(itemViews.entries())
    .map(([id, count]) => ({ id, count, title: titleById.get(id) ?? id }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-3">
      <Collapsible title="Recent failures" count={recentFailures.length} defaultOpen>
        {recentFailures.length === 0 ? (
          <p className={styles.emptyState}>No failures recorded — everything&apos;s healthy.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {recentFailures.map((failure, idx) => (
                  <tr key={`${failure.ts}-${idx}`}>
                    <td>{formatTs(failure.ts)}</td>
                    <td>{failure.label}</td>
                    <td className={styles.errorMessage}>{failure.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Collapsible>

      <Collapsible title="Pipeline">
        <h2 className={`${styles.sectionTitle} mono`}>Configured slots</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Slot (ICT)</th>
                <th>Last ran</th>
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              {lastRunPerSlot.map(({ slotUtc, run }) => (
                <tr key={slotUtc}>
                  <td>{utcToIct(slotUtc)}</td>
                  <td>{run ? formatTs(run.ts) : "never"}</td>
                  <td>{run ? run.totalFetched : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {latestRun && (
          <>
            <h2 className={`${styles.sectionTitle} mono`}>Latest run — per source</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Items</th>
                    <th>Status</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {latestRun.sources.map((source) => (
                    <tr key={source.sourceId}>
                      <td>{source.label}</td>
                      <td>{source.count}</td>
                      <td>
                        <span className={source.ok ? styles.badgeOk : styles.badgeFail}>
                          {source.ok ? "ok" : "fail"}
                        </span>
                      </td>
                      <td className={styles.errorMessage}>{source.error || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h2 className={`${styles.sectionTitle} mono`}>Recent runs</h2>
        {runs.length === 0 ? (
          <p className={styles.emptyState}>No fetch runs recorded yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Slot</th>
                  <th>Duration</th>
                  <th>Total</th>
                  <th>New</th>
                  <th>Failures</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.ts}>
                    <td>{formatTs(run.ts)}</td>
                    <td>{run.slot ? `${utcToIct(run.slot)} ICT` : "manual"}</td>
                    <td>{formatDuration(run.durationMs)}</td>
                    <td>{run.totalFetched}</td>
                    <td>{run.newItems ?? "—"}</td>
                    <td>{run.sources.filter((s) => !s.ok).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className={`${styles.sectionTitle} mono`}>Recent cron ticks</h2>
        {ticks.length === 0 ? (
          <p className={styles.emptyState}>No cron ticks recorded yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Duration</th>
                  <th>Fetched</th>
                  <th>Translated</th>
                  <th>Groq 429s</th>
                </tr>
              </thead>
              <tbody>
                {ticks.slice(0, 20).map((tick) => (
                  <tr key={tick.ts}>
                    <td>{formatTs(tick.ts)}</td>
                    <td>{formatDuration(tick.durationMs)}</td>
                    <td>{tick.fetched ?? "—"}</td>
                    <td>{tick.backfillProcessed}</td>
                    <td>{tick.groq429}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className={`${styles.sectionTitle} mono`}>Backfill history</h2>
        {backfill.length === 0 ? (
          <p className={styles.emptyState}>No backfill ticks recorded yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Processed</th>
                  <th>Failed</th>
                </tr>
              </thead>
              <tbody>
                {backfill.map((tick) => (
                  <tr key={tick.ts}>
                    <td>{formatTs(tick.ts)}</td>
                    <td>{tick.processed}</td>
                    <td>{tick.failureCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Collapsible>

      <Collapsible title="Traffic">
        <h2 className={`${styles.sectionTitle} mono`}>Home views, last {homeViewsDaily.length} days</h2>
        <ViewsLineChart data={homeViewsDaily} />

        <h2 className={`${styles.sectionTitle} mono`}>Most viewed articles</h2>
        {mostViewed.length === 0 ? (
          <p className={styles.emptyState}>No article views recorded yet.</p>
        ) : (
          <MostViewedChart items={mostViewed} />
        )}
      </Collapsible>

      <Collapsible title="System">
        <div className={styles.statGrid}>
          <div className={styles.statTile}>
            <span className={styles.statValue}>
              <span className={`${styles.dot} ${redisUp ? styles.dotUp : styles.dotDown}`} />
              {redisUp ? "Connected" : "Unreachable"}
            </span>
            <span className={styles.statLabel}>Redis</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>
              {githubRate ? `${githubRate.remaining} / ${githubRate.limit}` : "—"}
            </span>
            <span className={styles.statLabel}>GitHub API rate limit (live)</span>
          </div>
        </div>
      </Collapsible>
    </div>
  );
}
