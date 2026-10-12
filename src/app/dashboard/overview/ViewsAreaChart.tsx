"use client";

import { curveMonotoneX } from "@visx/curve";
import { useMemo } from "react";
import { Area } from "@/components/charts/area";
import { AreaChart } from "@/components/charts/area-chart";
import { DateLabelFormatProvider } from "@/components/charts/date-label-format";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";

// Days are UTC calendar days, so label them in UTC rather than the browser's zone.
const utcDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const formatUtcDay = (date: Date) => utcDay.format(date);

export type ViewsPoint = { date: string; count: number }; // date = "YYYY-MM-DD" (UTC)

export default function ViewsAreaChart({ points }: { points: ViewsPoint[] }) {
  const data = useMemo(
    () => points.map((p) => ({ date: new Date(`${p.date}T00:00:00Z`), views: p.count })),
    [points]
  );

  if (points.length < 2) {
    return <p className="px-1 py-6 text-sm text-ink-faint">No page views recorded yet.</p>;
  }

  return (
    <DateLabelFormatProvider value={formatUtcDay}>
      <AreaChart data={data} xDataKey="date" aspectRatio="3 / 1" margin={{ top: 16, right: 16, bottom: 40, left: 36 }}>
        <Grid horizontal />
        <Area dataKey="views" curve={curveMonotoneX} />
        <XAxis numTicks={5} />
        <YAxis numTicks={4} />
        <ChartTooltip
          rows={(point) => [{ color: "var(--chart-line-primary)", label: "Views", value: Number(point.views) }]}
        />
      </AreaChart>
      <p className="px-1 pt-1 text-xs text-ink-faint">Home page views per UTC day, last {points.length} days</p>
    </DateLabelFormatProvider>
  );
}
