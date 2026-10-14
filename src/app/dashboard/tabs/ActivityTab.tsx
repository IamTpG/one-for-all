import dynamic from "next/dynamic";
import { itemFunnel, runSankey } from "@/lib/activityData";
import { CRON_TICK_INTERVAL_MINUTES } from "@/lib/config";
import {
  loadBackfillHistory,
  loadItemViewCounts,
  loadRecentFailures,
  loadRuns,
  loadSettings,
  loadStoredItems,
  loadTickCountsDaily,
  loadTicks,
} from "@/lib/dashboardData";
import { formatDuration, formatTs } from "@/lib/format";
import { utcToIct } from "@/lib/schedule";
import Collapsible from "../Collapsible";
import styles from "../Dashboard.module.css";
import Card from "../overview/Card";
import ExpandableTable from "../activity/ExpandableTable";

// Only this tab pays for the heavy charts: they load as separate chunks.
const chartPlaceholder = () => <div className="h-48 animate-pulse rounded-xl bg-surface-sunken" />;
const ActivityHeatmap = dynamic(() => import("../activity/ActivityHeatmap"), { loading: chartPlaceholder });
const ItemFunnel = dynamic(() => import("../activity/ItemFunnel"), { loading: chartPlaceholder });
const SourceSankey = dynamic(() => import("../activity/SourceSankey"), { loading: chartPlaceholder });

const TICKS_PER_DAY = Math.floor((24 * 60) / CRON_TICK_INTERVAL_MINUTES);

// Lower-priority detail, one collapsible card each: failures (open), pipeline,
// and the four history tables.
export default async function ActivityTab() {
  const [settings, runs, ticks, backfill, recentFailures, items, itemViews, tickCounts] =
    await Promise.all([
      loadSettings(),
      loadRuns(),
      loadTicks(),
      loadBackfillHistory(),
      loadRecentFailures(),
      loadStoredItems(),
      loadItemViewCounts(),
      loadTickCountsDaily(),
    ]);

  const latestRun = runs[0] ?? null;
  const lastRunPerSlot = settings.fetchTimesUtc.map((slotUtc) => ({
    slotUtc,
    run: runs.find((run) => run.slot === slotUtc) ?? null,
  }));

  // Failing sources first, so they are inside the rows shown by default.
  const sourcesFailedFirst = [...(latestRun?.sources ?? [])].sort((a, b) => Number(a.ok) - Number(b.ok));

  const sankey = runSankey(latestRun);
  const funnel = itemFunnel(items, itemViews);

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

      <Collapsible title="Pipeline" defaultOpen>
        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          <Card title={`Cron health, last ${tickCounts.length} days`}>
            <ActivityHeatmap days={tickCounts} unit="ticks" expected={TICKS_PER_DAY} />
            <p className="px-1 pt-1 text-xs text-ink-faint">
              Ticks per UTC day against {TICKS_PER_DAY} expected. Counting started when this was deployed.
            </p>
          </Card>
          <Card title="Items in the store">
            <ItemFunnel stages={funnel} />
            <p className="px-1 pt-1 text-xs text-ink-faint">
              Stored, then summarised by AI, then translated, then opened at least once.
            </p>
          </Card>
        </div>
        <Card title="Latest fetch: new or already stored" className="mb-4">
          {sankey ? (
            <SourceSankey data={sankey} />
          ) : (
            <p className="px-1 py-6 text-sm text-ink-faint">Needs a fetch recorded after this feature shipped.</p>
          )}
        </Card>
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
      </Collapsible>

      <Collapsible title="Latest run: per source" count={latestRun?.sources.length}>
        {latestRun ? (
          <ExpandableTable
            initial={5}
            head={
              <tr>
                <th>Source</th>
                <th>Items</th>
                <th>Status</th>
                <th>Error</th>
              </tr>
            }
            rows={sourcesFailedFirst.map((source) => (
              <tr key={source.sourceId}>
                <td>{source.label}</td>
                <td>{source.count}</td>
                <td>
                  <span className={source.ok ? styles.badgeOk : styles.badgeFail}>{source.ok ? "ok" : "fail"}</span>
                </td>
                <td className={styles.errorMessage}>{source.error || "—"}</td>
              </tr>
            ))}
          />
        ) : (
          <p className={styles.emptyState}>No fetch runs recorded yet.</p>
        )}
      </Collapsible>

      <Collapsible title="Recent runs" count={runs.length}>
        {runs.length === 0 ? (
          <p className={styles.emptyState}>No fetch runs recorded yet.</p>
        ) : (
          <ExpandableTable
            head={
              <tr>
                <th>Time</th>
                <th>Slot</th>
                <th>Duration</th>
                <th>Total</th>
                <th>New</th>
                <th>Failures</th>
              </tr>
            }
            rows={runs.map((run) => (
              <tr key={run.ts}>
                <td>{formatTs(run.ts)}</td>
                <td>{run.slot ? `${utcToIct(run.slot)} ICT` : "manual"}</td>
                <td>{formatDuration(run.durationMs)}</td>
                <td>{run.totalFetched}</td>
                <td>{run.newItems ?? "—"}</td>
                <td>{run.sources.filter((s) => !s.ok).length}</td>
              </tr>
            ))}
          />
        )}
      </Collapsible>

      <Collapsible title="Recent cron ticks" count={ticks.length}>
        {ticks.length === 0 ? (
          <p className={styles.emptyState}>No cron ticks recorded yet.</p>
        ) : (
          <ExpandableTable
            head={
              <tr>
                <th>Time</th>
                <th>Duration</th>
                <th>Fetched</th>
                <th>Translated</th>
                <th>Groq 429s</th>
              </tr>
            }
            rows={ticks.map((tick) => (
              <tr key={tick.ts}>
                <td>{formatTs(tick.ts)}</td>
                <td>{formatDuration(tick.durationMs)}</td>
                <td>{tick.fetched ?? "—"}</td>
                <td>{tick.backfillProcessed}</td>
                <td>{tick.groq429}</td>
              </tr>
            ))}
          />
        )}
      </Collapsible>

      <Collapsible title="Backfill history" count={backfill.length}>
        {backfill.length === 0 ? (
          <p className={styles.emptyState}>No backfill ticks recorded yet.</p>
        ) : (
          <ExpandableTable
            head={
              <tr>
                <th>Time</th>
                <th>Processed</th>
                <th>Failed</th>
              </tr>
            }
            rows={backfill.map((tick) => (
              <tr key={tick.ts}>
                <td>{formatTs(tick.ts)}</td>
                <td>{tick.processed}</td>
                <td>{tick.failureCount}</td>
              </tr>
            ))}
          />
        )}
      </Collapsible>
    </div>
  );
}
