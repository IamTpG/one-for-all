"use client";

import { curveMonotoneX } from "@visx/curve";
import { useMemo } from "react";
import { Area } from "@/components/charts/area";
import { ComposedChart } from "@/components/charts/composed-chart";
import { DateLabelFormatProvider } from "@/components/charts/date-label-format";
import { Grid } from "@/components/charts/grid";
import { Line } from "@/components/charts/line";
import { SeriesBar } from "@/components/charts/series-bar";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";
import { formatBytes, formatCount } from "@/lib/chartUtils";
import type { MinutePoint, UpstashUsage } from "@/lib/upstashUsage";
import { CHART_MARGIN, ictTime, LIMIT_VISIBLE_RATIO, utcDay } from "./chartBits";

type Limits = { dataSizeBytes: number; bandwidthBytesPerMonth: number; commandsPerSecond: number };

function daysInMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

// Rows for a per-minute chart: one row per timestamp, one field per named series.
function minuteRows(series: Record<string, MinutePoint[]>): Record<string, unknown>[] {
  const rows = new Map<number, Record<string, unknown>>();
  for (const [key, points] of Object.entries(series)) {
    for (const p of points) {
      const row = rows.get(p.t) ?? { date: new Date(p.t) };
      row[key] = p.value;
      rows.set(p.t, row);
    }
  }
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
}

function ChartBlock({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1 px-1 text-sm font-bold text-ink">{title}</h3>
      {children}
      <p className="px-1 pt-1 text-xs text-ink-faint">{note}</p>
    </div>
  );
}

const MARGIN_LEFT_WIDE = { ...CHART_MARGIN, left: 60 };
const MARGIN_BOTH_WIDE = { ...CHART_MARGIN, left: 60, right: 64 };

export default function UpstashCharts({ data, limits }: { data: UpstashUsage; limits: Limits }) {
  const bandwidthRows = useMemo(() => {
    const { daily, monthBytes } = data.bandwidth;
    // The API lists only the last few days; whatever came before them this month
    // is the starting point of the month-to-date line.
    const base = Math.max(0, monthBytes - daily.reduce((sum, d) => sum + d.value, 0));
    return daily.map((d, i) => ({
      date: new Date(d.t),
      perDay: d.value,
      monthToDate: base + daily.slice(0, i + 1).reduce((sum, day) => sum + day.value, 0),
      budget: limits.bandwidthBytesPerMonth / daysInMonth(d.t),
    }));
  }, [data.bandwidth, limits.bandwidthBytesPerMonth]);

  const requestRows = useMemo(() => data.requests.daily.map((d) => ({ date: new Date(d.t), requests: d.value })), [data.requests.daily]);
  const sizeRows = useMemo(
    () => data.dataSize.series.map((p) => ({ date: new Date(p.t), size: p.value, limit: limits.dataSizeBytes })),
    [data.dataSize.series, limits.dataSizeBytes]
  );
  const throughputRows = useMemo(
    () => minuteRows({ read: data.throughput.read, write: data.throughput.write }).map((r): Record<string, unknown> => ({ ...r, limit: limits.commandsPerSecond })),
    [data.throughput, limits.commandsPerSecond]
  );
  const latencyRows = useMemo(() => minuteRows({ mean: data.latency.mean, p99: data.latency.p99 }), [data.latency]);

  const maxPerDay = Math.max(0, ...bandwidthRows.map((r) => r.perDay));
  const budget = bandwidthRows[0]?.budget ?? 0;
  const showBudget = budget > 0 && maxPerDay >= budget * LIMIT_VISIBLE_RATIO;
  const maxSize = Math.max(0, ...sizeRows.map((r) => r.size));
  const showSizeLimit = maxSize >= limits.dataSizeBytes * LIMIT_VISIBLE_RATIO;
  const maxThroughput = Math.max(0, ...throughputRows.map((r) => Number(r.read ?? 0) + Number(r.write ?? 0)));
  const showThroughputLimit = maxThroughput >= limits.commandsPerSecond * LIMIT_VISIBLE_RATIO;
  const perSec = (v: unknown) => Number(v ?? 0).toFixed(2);
  const minuteNote = "per-minute data, last 60 minutes · times in ICT";

  return (
    <div className="flex flex-col gap-5">
      <DateLabelFormatProvider value={utcDay}>
        <ChartBlock
          title="Bandwidth per day"
          note={`${showBudget ? "Dashed line: even daily share of the monthly limit · " : ""}Right axis: month to date · UTC days, the last bar is today so far`}
        >
          <ComposedChart data={bandwidthRows} xDataKey="date" aspectRatio="3 / 1" margin={MARGIN_BOTH_WIDE} barGap={0} maxBarSize={36}>
            <Grid horizontal />
            <SeriesBar dataKey="perDay" fill="var(--chart-1)" radius={3} />
            {showBudget && (
              <Line dataKey="budget" stroke="var(--danger)" strokeWidth={1.5} dashFromIndex={0} dashArray="6,4" showHighlight={false} />
            )}
            <Line dataKey="monthToDate" yAxisId="right" stroke="var(--chart-3)" curve={curveMonotoneX} />
            <XAxis />
            <YAxis numTicks={4} formatValue={formatBytes} />
            <YAxis yAxisId="right" orientation="right" numTicks={4} formatValue={formatBytes} />
            <ChartTooltip
              showCrosshair={false}
              rows={(p) => [
                { color: "var(--chart-1)", label: "That day", value: formatBytes(Number(p.perDay)) },
                { color: "var(--chart-3)", label: "Month to date", value: formatBytes(Number(p.monthToDate)) },
              ]}
            />
          </ComposedChart>
        </ChartBlock>
      </DateLabelFormatProvider>

      <div className="grid gap-5 lg:grid-cols-2">
        <DateLabelFormatProvider value={ictTime}>
          <ChartBlock title="Data size" note={`${showSizeLimit ? "Dashed line: data size limit · " : ""}${minuteNote}`}>
            <ComposedChart data={sizeRows} xDataKey="date" aspectRatio="2 / 1" margin={MARGIN_LEFT_WIDE}>
              <Grid horizontal />
              <Area dataKey="size" curve={curveMonotoneX} />
              {showSizeLimit && (
                <Line dataKey="limit" stroke="var(--danger)" strokeWidth={1.5} dashFromIndex={0} dashArray="6,4" showHighlight={false} />
              )}
              <XAxis numTicks={5} />
              <YAxis numTicks={4} formatValue={formatBytes} />
              <ChartTooltip rows={(p) => [{ color: "var(--chart-line-primary)", label: "Data size", value: formatBytes(Number(p.size)) }]} />
            </ComposedChart>
          </ChartBlock>
        </DateLabelFormatProvider>

        <DateLabelFormatProvider value={utcDay}>
          <ChartBlock title="Requests per day" note="UTC days, the last bar is today so far">
            <ComposedChart data={requestRows} xDataKey="date" aspectRatio="2 / 1" margin={CHART_MARGIN} barGap={0} maxBarSize={36}>
              <Grid horizontal />
              <SeriesBar dataKey="requests" fill="var(--chart-1)" radius={3} />
              <XAxis />
              <YAxis numTicks={4} />
              <ChartTooltip showCrosshair={false} rows={(p) => [{ color: "var(--chart-1)", label: "Requests", value: formatCount(Number(p.requests)) }]} />
            </ComposedChart>
          </ChartBlock>
        </DateLabelFormatProvider>
      </div>

      <DateLabelFormatProvider value={ictTime}>
        <ChartBlock title="Throughput (commands per sec)" note={`${showThroughputLimit ? "Dashed line: commands/sec limit · " : ""}${minuteNote}`}>
          <ComposedChart data={throughputRows} xDataKey="date" aspectRatio="3 / 1" margin={CHART_MARGIN}>
            <Grid horizontal />
            {showThroughputLimit && (
              <Line dataKey="limit" stroke="var(--danger)" strokeWidth={1.5} dashFromIndex={0} dashArray="6,4" showHighlight={false} />
            )}
            <Line dataKey="read" stroke="var(--chart-1)" curve={curveMonotoneX} />
            <Line dataKey="write" stroke="var(--chart-2)" curve={curveMonotoneX} />
            <XAxis numTicks={6} />
            <YAxis numTicks={4} />
            <ChartTooltip
              rows={(p) => [
                { color: "var(--chart-1)", label: "Read", value: perSec(p.read) },
                { color: "var(--chart-2)", label: "Write", value: perSec(p.write) },
                { color: "var(--text-faint)", label: "Total", value: perSec(Number(p.read ?? 0) + Number(p.write ?? 0)) },
              ]}
            />
          </ComposedChart>
        </ChartBlock>

        <ChartBlock title="Latency" note="unit not documented by Upstash (likely ms) · last 60 minutes · times in ICT">
          <ComposedChart data={latencyRows} xDataKey="date" aspectRatio="4 / 1" margin={CHART_MARGIN}>
            <Grid horizontal />
            <Line dataKey="mean" stroke="var(--chart-1)" curve={curveMonotoneX} />
            <Line dataKey="p99" stroke="var(--chart-2)" curve={curveMonotoneX} />
            <XAxis numTicks={6} />
            <YAxis numTicks={3} />
            <ChartTooltip
              rows={(p) => [
                { color: "var(--chart-1)", label: "Mean", value: perSec(p.mean) },
                { color: "var(--chart-2)", label: "p99", value: perSec(p.p99) },
              ]}
            />
          </ComposedChart>
        </ChartBlock>
      </DateLabelFormatProvider>
    </div>
  );
}
