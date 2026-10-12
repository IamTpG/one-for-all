"use client";

import { useChart } from "@/components/charts/chart-context";
import { formatTime } from "@/lib/chartUtils";

// Shared by the Limits charts.

// The app shows times in ICT; days are UTC calendar days.
export const ictTime = (date: Date) => formatTime(date.getTime());
const utcDayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const utcDay = (date: Date) => utcDayFmt.format(date);

export const CHART_MARGIN = { top: 16, right: 16, bottom: 28, left: 48 };

// A limit line only appears once the data reaches this share of the limit;
// below that it just flattens the data against the floor.
export const LIMIT_VISIBLE_RATIO = 0.05;

// Red dots along the top for the buckets in which Groq answered 429. Rate
// limited calls carry no usage, so a bar never shows them.
export function RateLimitMarkers({ dataKey }: { dataKey: string }) {
  const { data, xScale, xAccessor } = useChart();
  return (
    <g pointerEvents="none">
      {data.map((row, i) =>
        Number(row[dataKey]) > 0 ? (
          <circle key={i} cx={xScale(xAccessor(row))} cy={6} r={3} fill="var(--danger)" />
        ) : null
      )}
    </g>
  );
}
