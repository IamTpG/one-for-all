"use client";

import { formatBytes, formatCount, formatTime, ictParts } from "@/lib/chartUtils";
import { UPSTASH_LIMITS } from "@/lib/config";
import type { DayPoint, MinutePoint, UpstashUsageResult } from "@/lib/upstashUsage";
import styles from "./Dashboard.module.css";
import Meter from "./Meter";
import SeriesChart from "./SeriesChart";

function minuteHeadings(points: MinutePoint[]): string[] {
  return points.map((p) => `${formatTime(p.t)} ICT`);
}

// Label every 10th minute; the API's points are exactly one minute apart.
function minuteTicks(points: MinutePoint[]): (string | null)[] {
  return points.map((p) => (Number(ictParts(p.t).mm) % 10 === 0 ? formatTime(p.t) : null));
}

function dayLabels(points: DayPoint[]): string[] {
  return points.map((p) => p.label);
}

function daysInCurrentMonth(): number {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
}

function percent(value: number, total: number): string {
  return `${((value / total) * 100).toFixed(value / total < 0.1 ? 2 : 0)}%`;
}

// Ordered by how often it's worth looking: bandwidth is the limit most
// likely to run out, then storage; throughput and latency are for debugging.
export default function UpstashSection({ result }: { result: UpstashUsageResult }) {
  if (result.status === "disabled") return null;

  if (result.status === "error") {
    return (
      <section className={styles.section}>
        <h2 className={`${styles.sectionTitle} mono`}>Upstash Usage</h2>
        <p className={styles.emptyState}>Upstash usage unavailable: {result.message}</p>
      </section>
    );
  }

  const { bandwidth, dataSize, requests, throughput, latency } = result.data;
  const todayRequests = requests.daily.at(-1)?.value ?? 0;

  return (
    <section className={styles.section}>
      <h2 className={`${styles.sectionTitle} mono`}>Upstash Usage</h2>

      <Meter
        label="Bandwidth this month"
        value={bandwidth.monthBytes}
        total={UPSTASH_LIMITS.bandwidthBytesPerMonth}
        displayText={`${formatBytes(bandwidth.monthBytes)} / ${formatBytes(UPSTASH_LIMITS.bandwidthBytesPerMonth)}`}
      />
      <Meter
        label="Data size"
        value={dataSize.currentBytes}
        total={UPSTASH_LIMITS.dataSizeBytes}
        displayText={`${formatBytes(dataSize.currentBytes)} / ${formatBytes(UPSTASH_LIMITS.dataSizeBytes)}`}
      />

      <div className={styles.statGrid}>
        <div className={styles.statTile}>
          <span className={styles.statValue}>
            {bandwidth.projectedMonthBytes === null ? "—" : formatBytes(bandwidth.projectedMonthBytes)}
          </span>
          <span className={styles.statLabel}>
            {bandwidth.projectedMonthBytes === null
              ? "Projected month-end bandwidth (needs a day of data)"
              : `Projected month-end bandwidth (${percent(bandwidth.projectedMonthBytes, UPSTASH_LIMITS.bandwidthBytesPerMonth)} of limit)`}
          </span>
        </div>
        <div className={styles.statTile}>
          <span className={styles.statValue}>{throughput.latestPerSec.toFixed(2)}</span>
          <span className={styles.statLabel}>
            Commands/sec, last-minute average (limit {formatCount(UPSTASH_LIMITS.commandsPerSecond)})
          </span>
        </div>
        <div className={styles.statTile}>
          <span className={styles.statValue}>{formatCount(todayRequests)}</span>
          <span className={styles.statLabel}>Requests today</span>
        </div>
        <div className={styles.statTile}>
          <span className={styles.statValue}>{formatCount(requests.monthTotal)}</span>
          <span className={styles.statLabel}>Requests this month</span>
        </div>
      </div>

      <SeriesChart
        title="Bandwidth per day"
        kind="bar"
        headings={dayLabels(bandwidth.daily)}
        tickLabels={dayLabels(bandwidth.daily)}
        series={[{ name: "Bandwidth", values: bandwidth.daily.map((d) => d.value), tone: "primary" }]}
        formatValue={formatBytes}
        formatAxisValue={formatBytes}
        limit={{
          value: UPSTASH_LIMITS.bandwidthBytesPerMonth / daysInCurrentMonth(),
          label: "Even daily share of the monthly limit",
        }}
        note="UTC days; the last bar is today so far"
      />

      <SeriesChart
        title="Data size"
        kind="line"
        headings={minuteHeadings(dataSize.series)}
        tickLabels={minuteTicks(dataSize.series)}
        series={[{ name: "Data size", values: dataSize.series.map((p) => p.value), tone: "primary" }]}
        formatValue={formatBytes}
        formatAxisValue={formatBytes}
        limit={{ value: UPSTASH_LIMITS.dataSizeBytes, label: "Data size limit" }}
        note="last 60 minutes · ICT"
      />

      <SeriesChart
        title="Requests per day"
        kind="bar"
        headings={dayLabels(requests.daily)}
        tickLabels={dayLabels(requests.daily)}
        series={[{ name: "Requests", values: requests.daily.map((d) => d.value), tone: "primary" }]}
        formatValue={formatCount}
        note="UTC days; the last bar is today so far"
      />

      <SeriesChart
        title="Throughput (commands per sec)"
        kind="line"
        smooth
        showTotal
        headings={minuteHeadings(throughput.read)}
        tickLabels={minuteTicks(throughput.read)}
        series={[
          { name: "Read", values: throughput.read.map((p) => p.value), tone: "primary" },
          { name: "Write", values: throughput.write.map((p) => p.value), tone: "secondary" },
        ]}
        formatValue={(n) => n.toFixed(2)}
        limit={{ value: UPSTASH_LIMITS.commandsPerSecond, label: "Commands/sec limit" }}
        note="per-minute average · last 60 minutes · ICT"
      />

      <SeriesChart
        title="Latency"
        kind="line"
        smooth
        headings={minuteHeadings(latency.mean)}
        tickLabels={minuteTicks(latency.mean)}
        series={[
          { name: "Mean", values: latency.mean.map((p) => p.value), tone: "primary" },
          { name: "p99", values: latency.p99.map((p) => p.value), tone: "secondary" },
        ]}
        formatValue={(n) => n.toFixed(2)}
        note="unit not documented by Upstash (likely ms) · last 60 minutes · ICT"
      />
    </section>
  );
}
