"use client";

import { curveMonotoneX } from "@visx/curve";
import { useMemo } from "react";
import { Grid } from "@/components/charts/grid";
import { Line } from "@/components/charts/line";
import { LineChart } from "@/components/charts/line-chart";
import { DateLabelFormatProvider } from "@/components/charts/date-label-format";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";
import { formatTime } from "@/lib/chartUtils";

// Same rule as the other usage charts: a limit line only appears once the data
// reaches this share of it, otherwise it just flattens the data to the floor.
const LIMIT_VISIBLE_RATIO = 0.05;

// Hours:minutes in ICT, like everywhere else in the app.
const ictTime = (date: Date) => formatTime(date.getTime());

export type TickPoint = { t: number; seconds: number };

// Duration of the recent cron ticks (oldest to newest) against the function's
// time limit.
export default function TickDurationChart({ ticks, limitSeconds }: { ticks: TickPoint[]; limitSeconds: number }) {
  const data = useMemo(
    () => ticks.map((tick) => ({ date: new Date(tick.t), seconds: tick.seconds, limit: limitSeconds })),
    [ticks, limitSeconds]
  );
  const longest = Math.max(0, ...ticks.map((tick) => tick.seconds));
  const showLimit = longest >= limitSeconds * LIMIT_VISIBLE_RATIO;

  if (ticks.length < 2) {
    return <p className="px-1 py-6 text-sm text-ink-faint">Not enough cron ticks recorded yet.</p>;
  }

  return (
    <DateLabelFormatProvider value={ictTime}>
      <LineChart data={data} xDataKey="date" aspectRatio="3 / 1" margin={{ top: 16, right: 16, bottom: 28, left: 44 }}>
        <Grid horizontal />
        {showLimit && (
          <Line dataKey="limit" stroke="var(--danger)" strokeWidth={1.5} dashFromIndex={0} dashArray="6,4" showHighlight={false} />
        )}
        <Line dataKey="seconds" curve={curveMonotoneX} />
        <XAxis numTicks={5} />
        <YAxis numTicks={4} formatValue={(v) => `${v}s`} />
        <ChartTooltip
          rows={(point) => [
            { color: "var(--chart-line-primary)", label: "Duration", value: `${Number(point.seconds).toFixed(1)}s` },
          ]}
        />
      </LineChart>
      <p className="px-1 pt-1 text-xs text-ink-faint">
        {showLimit ? `Dashed line: ${limitSeconds}s function limit · ` : ""}times in ICT, oldest to newest
      </p>
    </DateLabelFormatProvider>
  );
}
