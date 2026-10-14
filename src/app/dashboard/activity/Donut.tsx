"use client";

import { useState } from "react";
import { Legend } from "@/components/charts/legend/legend";
import { LegendItem } from "@/components/charts/legend/legend-item";
import { LegendLabel } from "@/components/charts/legend/legend-label";
import { LegendMarker } from "@/components/charts/legend/legend-marker";
import { LegendValue } from "@/components/charts/legend/legend-value";
import { PieCenter } from "@/components/charts/pie-center";
import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import type { Slice } from "@/lib/activityData";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const OTHER_COLOR = "var(--text-faint)";

const colorOf = (slice: Slice, i: number) => (slice.label === "Other" ? OTHER_COLOR : COLORS[i % COLORS.length]);

// Donut with the total in the middle (the hovered slice while hovering). The
// legend below shares its hover state, so pointing at a row lights its slice.
export default function Donut({ slices, centerLabel }: { slices: Slice[]; centerLabel: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (slices.length === 0) return <p className="px-1 py-6 text-sm text-ink-faint">Nothing recorded yet.</p>;

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const data = slices.map((slice, i) => ({ ...slice, color: colorOf(slice, i), maxValue: total }));

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[200px]">
        <PieChart
          data={data}
          innerRadius={58}
          padAngle={0.02}
          cornerRadius={3}
          hoverOffset={6}
          hoveredIndex={hovered}
          onHoverChange={setHovered}
        >
          {data.map((slice, i) => (
            <PieSlice key={slice.label} index={i} />
          ))}
          <PieCenter defaultLabel={centerLabel} />
        </PieChart>
      </div>
      <Legend items={data} hoveredIndex={hovered} onHoverChange={setHovered} className="w-full gap-0.5">
        <LegendItem className="flex items-center gap-2 text-xs">
          <LegendMarker />
          <LegendLabel className="truncate text-ink-muted" />
          <LegendValue className="ml-auto font-mono text-ink-faint" showPercentage />
        </LegendItem>
      </Legend>
    </div>
  );
}
