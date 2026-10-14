"use client";

import { HeatmapCells } from "@/components/charts/heatmap/heatmap-cells";
import { HeatmapChart } from "@/components/charts/heatmap/heatmap-chart";
import { HeatmapLegend } from "@/components/charts/heatmap/heatmap-legend";
import { HeatmapTooltip } from "@/components/charts/heatmap/heatmap-tooltip";
import { HeatmapXAxis } from "@/components/charts/heatmap/heatmap-x-axis";
import { HeatmapYAxis } from "@/components/charts/heatmap/heatmap-y-axis";
import { type DayCount, toCalendarColumns } from "@/lib/activityData";

const utcDay = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

// One square per UTC day, a column per week. `unit` words the tooltip, e.g.
// "home views" or "ticks".
export default function ActivityHeatmap({ days, unit, expected }: { days: DayCount[]; unit: string; expected?: number }) {
  const columns = toCalendarColumns(days);
  return (
    <div className="flex flex-col gap-2">
      <HeatmapChart data={columns} layout="fluid" gap={3} margin={{ top: 24, right: 8, bottom: 0, left: 36 }}>
        <HeatmapXAxis />
        <HeatmapYAxis tickFilter="odd" labelFormat="full" />
        <HeatmapCells cornerRadius={3} />
        <HeatmapTooltip
          formatLabel={(count, date) =>
            `${utcDay.format(date)}: ${count.toLocaleString("en-US")}${expected ? ` / ${expected}` : ""} ${unit}`
          }
        />
      </HeatmapChart>
      <HeatmapLegend />
    </div>
  );
}
