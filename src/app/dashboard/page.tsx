import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DASHBOARD_RECENT_FAILURES_DISPLAY_LIMIT } from "@/lib/config";
import {
  getBackfillHistory,
  getGroqFailures,
  getHomeViewsDaily,
  getHomeViewStats,
  getItemViewCounts,
  getLanguageToggleStats,
  getRecentRuns,
  pingRedis,
  type FetchRunRecord,
} from "@/lib/dashboardStats";
import { fetchGithubSearchRateLimit } from "@/lib/fetchers/github";
import { isOwnerRequest, OWNER_COOKIE_NAME } from "@/lib/ownerAuth";
import { nextScheduledSlot, utcToIct } from "@/lib/schedule";
import { getSiteSettings } from "@/lib/siteSettings";
import { getAiBacklogSize, getStoredItems } from "@/lib/store";
import PageHeader from "../PageHeader";
import ThemeToggle from "../ThemeToggle";
import styles from "./Dashboard.module.css";
import Meter from "./Meter";
import MostViewedChart from "./MostViewedChart";
import ViewsLineChart from "./ViewsLineChart";

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  if (!isOwnerRequest(cookieStore.get(OWNER_COOKIE_NAME)?.value)) {
    redirect("/owner-login");
  }

  const [
    settings,
    recentRuns,
    backfillHistory,
    groqFailures,
    backlogSize,
    homeViews,
    itemViewCounts,
    toggleStats,
    storedItems,
    redisUp,
    githubSearchRateLimit,
    homeViewsDaily,
  ] = await Promise.all([
    getSiteSettings(),
    getRecentRuns(),
    getBackfillHistory(),
    getGroqFailures(),
    getAiBacklogSize(),
    getHomeViewStats(),
    getItemViewCounts(),
    getLanguageToggleStats(),
    getStoredItems(),
    pingRedis(),
    fetchGithubSearchRateLimit(),
    getHomeViewsDaily(),
  ]);

  const nextDue = nextScheduledSlot(new Date(), settings.fetchTimesUtc);
  const latestRun: FetchRunRecord | null = recentRuns[0] ?? null;

  const lastRunPerSlot = settings.fetchTimesUtc.map((slotUtc) => ({
    slotUtc,
    run: recentRuns.find((run) => run.slot === slotUtc) ?? null,
  }));

  const recentFailures = [
    ...recentRuns.flatMap((run) =>
      run.sources
        .filter((source) => !source.ok)
        .map((source) => ({ ts: run.ts, label: source.label, message: source.error || "Unknown error" }))
    ),
    ...groqFailures.map((failure) => ({
      ts: failure.ts,
      label: `groq:${failure.stage} (${failure.itemId})`,
      message: failure.message,
    })),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, DASHBOARD_RECENT_FAILURES_DISPLAY_LIMIT);

  const titleById = new Map(storedItems.map((item) => [item.id, item.title]));
  const mostViewed = Array.from(itemViewCounts.entries())
    .map(([id, count]) => ({ id, count, title: titleById.get(id) ?? id }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const lastBackfillTick = backfillHistory[0] ?? null;
  const backfillFailureTotal = backfillHistory.reduce((sum, tick) => sum + tick.failureCount, 0);

  const sourcesOk = latestRun?.sources.filter((source) => source.ok).length ?? 0;
  const sourcesTotal = latestRun?.sources.length ?? 0;

  const translatedCount = Math.max(0, storedItems.length - backlogSize);

  return (
    <div className={styles.page}>
      <PageHeader tagline="DASHBOARD" actions={<ThemeToggle />} />

      <main className={styles.content}>
        <section className={styles.section}>
          <h2 className={`${styles.sectionTitle} mono`}>Cron / Fetch Health</h2>
          <div className={styles.statGrid}>
            <div className={styles.statTile}>
              <span className={styles.statValue}>
                {nextDue ? `${utcToIct(nextDue.slotUtc)} ICT` : "—"}
              </span>
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
          {recentRuns.length === 0 ? (
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
                    <th>Failures</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((run) => (
                    <tr key={run.ts}>
                      <td>{formatTs(run.ts)}</td>
                      <td>{run.slot ? `${utcToIct(run.slot)} ICT` : "manual"}</td>
                      <td>{formatDuration(run.durationMs)}</td>
                      <td>{run.totalFetched}</td>
                      <td>{run.sources.filter((s) => !s.ok).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={`${styles.sectionTitle} mono`}>AI Pipeline</h2>
          <div className={styles.statGrid}>
            <div className={styles.statTile}>
              <span className={styles.statValue}>{backlogSize}</span>
              <span className={styles.statLabel}>Items awaiting translation</span>
            </div>
            <div className={styles.statTile}>
              <span className={styles.statValue}>{lastBackfillTick ? lastBackfillTick.processed : "—"}</span>
              <span className={styles.statLabel}>Processed last tick</span>
            </div>
            <div className={styles.statTile}>
              <span className={styles.statValue}>{backfillFailureTotal}</span>
              <span className={styles.statLabel}>Recent Groq failures</span>
            </div>
          </div>

          <Meter
            label="Items translated"
            value={translatedCount}
            total={storedItems.length}
            displayText={`${translatedCount} / ${storedItems.length}`}
          />

          {backfillHistory.length === 0 ? (
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
                  {backfillHistory.map((tick) => (
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
        </section>

        <section className={styles.section}>
          <h2 className={`${styles.sectionTitle} mono`}>Recent Failures</h2>
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
              <span className={styles.statValue}>{toggleStats.en} / {toggleStats.vi}</span>
              <span className={styles.statLabel}>EN / VI toggles</span>
            </div>
          </div>

          <h2 className={`${styles.sectionTitle} mono`}>Home views, last {homeViewsDaily.length} days</h2>
          <ViewsLineChart data={homeViewsDaily} />

          <h2 className={`${styles.sectionTitle} mono`}>Most viewed articles</h2>
          {mostViewed.length === 0 ? (
            <p className={styles.emptyState}>No article views recorded yet.</p>
          ) : (
            <MostViewedChart items={mostViewed} />
          )}
        </section>

        <section className={styles.section}>
          <h2 className={`${styles.sectionTitle} mono`}>System</h2>
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
                {githubSearchRateLimit
                  ? `${githubSearchRateLimit.remaining} / ${githubSearchRateLimit.limit}`
                  : "—"}
              </span>
              <span className={styles.statLabel}>GitHub API rate limit (live)</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
