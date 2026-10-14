import dynamic from "next/dynamic";
import Link from "next/link";
import { itemsBySource, itemsByTopic, topSlices } from "@/lib/activityData";
import { formatBytes } from "@/lib/chartUtils";
import { GROQ_LIMITS, UPSTASH_LIMITS } from "@/lib/config";
import {
  loadBacklogSize,
  loadGithubRateLimit,
  loadGroqUsage,
  loadHomeViews,
  loadHomeViewsHeatmap,
  loadItemViewCounts,
  loadRecentFailures,
  loadRuns,
  loadSettings,
  loadStatus,
  loadStoredItems,
  loadTickStats,
  loadTicks,
  loadToggleStats,
  loadUpstashUsage,
} from "@/lib/dashboardData";
import type { CheckLevel } from "@/lib/dashboardStatus";
import { formatAgo, formatDuration, formatMinutes, formatTs } from "@/lib/format";
import { nextScheduledSlot, utcToIct } from "@/lib/schedule";
import Donut from "../activity/Donut";
import MostViewedBars from "../activity/MostViewedBars";
import { Card, Tile, type Tone } from "../overview";
import LimitGauge from "../overview/LimitGauge";
import PipelineRing from "../overview/PipelineRing";
import TickDurationChart from "../overview/TickDurationChart";

// Loaded as its own chunk, so the other tabs do not pay for it.
const ActivityHeatmap = dynamic(() => import("../activity/ActivityHeatmap"), {
  loading: () => <div className="h-48 animate-pulse rounded-xl bg-surface-sunken" />,
});

const n = (value: number) => value.toLocaleString("en-US");

// formatBytes gives "6.02 MB"; the gauge wants the number and its unit apart.
function splitBytes(bytes: number): { value: number; unit: string; digits: number } {
  const [num, unit] = formatBytes(bytes).split(" ");
  return { value: Number(num), unit: ` ${unit}`, digits: num.includes(".") ? num.split(".")[1].length : 0 };
}

const toneOf = (level: CheckLevel | undefined): Tone => (level === "bad" ? "bad" : level === "warn" ? "warn" : "default");

// The at-a-glance tab: the numbers worth a daily look. Details live in the
// other tabs.
export default async function OverviewTab() {
  const [settings, runs, ticks, tickStats, items, backlog, groq, upstash, homeViews, homeViewsHeatmap, itemViews, toggles, failures, github, status] =
    await Promise.all([
      loadSettings(),
      loadRuns(),
      loadTicks(),
      loadTickStats(),
      loadStoredItems(),
      loadBacklogSize(),
      loadGroqUsage(),
      loadUpstashUsage(),
      loadHomeViews(),
      loadHomeViewsHeatmap(),
      loadItemViewCounts(),
      loadToggleStats(),
      loadRecentFailures(),
      loadGithubRateLimit(),
      loadStatus(),
    ]);

  const tone = (id: string) => toneOf(status.checks.find((check) => check.id === id)?.level);

  const nextDue = nextScheduledSlot(new Date(), settings.fetchTimesUtc);
  const latestRun = runs[0] ?? null;
  const lastTick = ticks[0] ?? null;
  const longestTickMs = ticks.reduce((max, tick) => Math.max(max, tick.durationMs), 0);
  // items is sorted newest-first by publish date.
  const newestItem = items[0] ?? null;
  const sourcesOk = latestRun?.sources.filter((source) => source.ok).length ?? 0;
  const sourcesTotal = latestRun?.sources.length ?? 0;
  const translated = Math.max(0, items.length - backlog);

  const rings = [
    { label: "Translated", value: translated, max: items.length },
    ...(latestRun ? [{ label: "Sources OK", value: sourcesOk, max: sourcesTotal }] : []),
    { label: "Ticks today", value: Math.min(tickStats.ticksToday, tickStats.expectedSoFar), max: tickStats.expectedSoFar },
  ];

  // Oldest to newest, like the x axis.
  const tickPoints = [...ticks].reverse().map((tick) => ({ t: tick.ts, seconds: tick.durationMs / 1000 }));

  const titleById = new Map(items.map((item) => [item.id, item.title]));
  const mostViewed = Array.from(itemViews.entries())
    .map(([id, count]) => ({ id, count, title: titleById.get(id) ?? id }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const langSlices = [
    { label: "English", value: toggles.en },
    { label: "Vietnamese", value: toggles.vi },
  ].filter((slice) => slice.value > 0);

  const bandwidth = upstash.status === "ok" ? upstash.data.bandwidth.monthBytes : null;
  const dataSize = upstash.status === "ok" ? upstash.data.dataSize.currentBytes : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <LimitGauge
          name="Groq tokens today"
          percent={(groq.today.tokens / GROQ_LIMITS.tokensPerDay) * 100}
          centerValue={groq.today.tokens}
          sub={`${n(groq.today.tokens)} / ${n(GROQ_LIMITS.tokensPerDay)} · UTC day`}
        />
        <LimitGauge
          name="Groq requests today"
          percent={(groq.today.requests / GROQ_LIMITS.requestsPerDay) * 100}
          centerValue={groq.today.requests}
          sub={`${n(groq.today.requests)} / ${n(GROQ_LIMITS.requestsPerDay)} · UTC day`}
        />
        {bandwidth !== null && dataSize !== null ? (
          <>
            <LimitGauge
              name="Upstash bandwidth"
              percent={(bandwidth / UPSTASH_LIMITS.bandwidthBytesPerMonth) * 100}
              centerValue={splitBytes(bandwidth).value}
              centerSuffix={splitBytes(bandwidth).unit}
              centerFractionDigits={splitBytes(bandwidth).digits}
              sub={`${formatBytes(bandwidth)} / ${formatBytes(UPSTASH_LIMITS.bandwidthBytesPerMonth)} this month`}
            />
            <LimitGauge
              name="Upstash data size"
              percent={(dataSize / UPSTASH_LIMITS.dataSizeBytes) * 100}
              centerValue={splitBytes(dataSize).value}
              centerSuffix={splitBytes(dataSize).unit}
              centerFractionDigits={splitBytes(dataSize).digits}
              sub={`${formatBytes(dataSize)} / ${formatBytes(UPSTASH_LIMITS.dataSizeBytes)}`}
            />
          </>
        ) : (
          <Card title="Upstash" className="col-span-2 flex items-center justify-center text-sm text-ink-faint">
            {upstash.status === "error" ? `Usage unavailable: ${upstash.message}` : "Usage panel not configured"}
          </Card>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        <Card title="Pipeline">
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-full max-w-[220px] shrink-0 sm:w-[190px]">
              <PipelineRing rings={rings} summary={status.level === "ok" ? "Healthy" : "Attention"} />
            </div>
            <div className="grid min-w-[260px] flex-1 grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
              <Tile
                value={nextDue ? `${utcToIct(nextDue.slotUtc)} ICT` : "—"}
                label={`Next fetch ${nextDue ? `in ${formatMinutes(nextDue.minutesUntil)}` : "not scheduled"}`}
                tone={tone("fetch")}
              />
              <Tile
                value={latestRun ? formatTs(latestRun.ts) : "never"}
                label={latestRun ? `Last fetch · ${latestRun.totalFetched} items · ${formatDuration(latestRun.durationMs)}` : "Last fetch"}
              />
              <Tile value={latestRun?.newItems ?? "—"} label="New items in last fetch" />
              <Tile
                value={newestItem ? formatAgo(new Date(newestItem.publishedAt).getTime()) : "—"}
                label="Newest item published"
              />
              <Tile value={lastTick ? formatAgo(lastTick.ts) : "never"} label="Last cron tick" tone={tone("tick")} />
              <Tile value={`${tickStats.ticksToday} / ${tickStats.expectedSoFar}`} label="Ticks today (UTC) / expected" />
              <Tile
                value={ticks.length > 0 ? formatDuration(longestTickMs) : "—"}
                label={`Longest of last ${ticks.length} ticks (limit 60s)`}
                tone={tone("tickDuration")}
              />
              <Tile value={backlog} label="Items awaiting translation" tone={tone("backlog")} />
              {latestRun && (
                <Tile value={`${sourcesOk} / ${sourcesTotal}`} label="Sources OK in last fetch" tone={tone("sources")} />
              )}
            </div>
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-3">
          <Card title="Traffic & problems">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
              <Tile value={homeViews.today} label="Home views today" />
              <Tile value={homeViews.total} label="Home views total" />
              <Tile value={`${toggles.en} / ${toggles.vi}`} label="EN / VI toggles" />
              <Tile value={failures.length} label="Recent failures" tone={failures.length > 0 ? "warn" : "default"} />
              <Tile value={groq.today.rateLimited} label="Groq 429s today" tone={groq.today.rateLimited > 0 ? "warn" : "default"} />
              <Tile value={github ? n(github.remaining) : "—"} label="GitHub API left" />
            </div>
            <p className="mt-3 px-1 text-xs text-ink-faint">
              Details:{" "}
              <Link href="/dashboard?tab=activity" prefetch={false} className="text-accent underline">
                Activity › Recent failures
              </Link>
            </p>
          </Card>

          <Card title="Cron tick duration">
            <TickDurationChart ticks={tickPoints} limitSeconds={60} />
          </Card>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card title="Language toggles">
          <Donut slices={langSlices} centerLabel="toggles" />
        </Card>
        <Card title="Items by source">
          <Donut slices={topSlices(itemsBySource(items), 5)} centerLabel="items" />
        </Card>
        <Card title="Items by topic">
          <Donut slices={topSlices(itemsByTopic(items), 5)} centerLabel="tags" />
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title={`Home views, last ${homeViewsHeatmap.length} days`}>
          <ActivityHeatmap days={homeViewsHeatmap} unit="home views" />
        </Card>
        <Card title="Most viewed articles" className="flex flex-col">
          <MostViewedBars items={mostViewed} />
        </Card>
      </div>
    </div>
  );
}
