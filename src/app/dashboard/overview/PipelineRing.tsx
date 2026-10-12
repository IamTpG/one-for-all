"use client";

import { Ring } from "@/components/charts/ring";
import { RingCenter } from "@/components/charts/ring-center";
import { RingChart } from "@/components/charts/ring-chart";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export type RingItem = { label: string; value: number; max: number };

// Concentric progress rings, one per "done / expected" figure. The centre shows
// the summary until a ring is hovered, then that ring's numbers.
export default function PipelineRing({ rings, summary }: { rings: RingItem[]; summary: string }) {
  const data = rings.map((ring, i) => ({
    label: ring.label,
    value: ring.value,
    maxValue: Math.max(ring.max, 1),
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="flex flex-col items-center gap-2">
      <RingChart data={data} size={170} strokeWidth={9} ringGap={5} baseInnerRadius={36}>
        {data.map((ring, i) => (
          <Ring key={ring.label} index={i} />
        ))}
        <RingCenter defaultLabel="pipeline">
          {({ isHovered, data: hovered, label }) => (
            <>
              <span className="text-xl font-bold text-ink">
                {isHovered ? `${hovered.value}/${hovered.maxValue}` : summary}
              </span>
              <span className="text-xs text-ink-faint">{label}</span>
            </>
          )}
        </RingCenter>
      </RingChart>
      <ul className="w-full space-y-1 text-xs">
        {data.map((ring) => (
          <li key={ring.label} className="flex items-center gap-2 text-ink-muted">
            <span className="size-2 rounded-full" style={{ background: ring.color }} />
            {ring.label}
            <span className="ml-auto font-mono text-ink-faint">
              {ring.value}/{ring.maxValue}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
