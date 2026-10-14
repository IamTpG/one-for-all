"use client";

import { FunnelChart } from "@/components/charts/funnel-chart";
import type { Slice } from "@/lib/activityData";

// Items in the store, narrowing stage by stage.
export default function ItemFunnel({ stages }: { stages: Slice[] }) {
  if ((stages[0]?.value ?? 0) === 0) return <p className="px-1 py-6 text-sm text-ink-faint">No items stored yet.</p>;
  return (
    <FunnelChart
      data={stages}
      orientation="horizontal"
      color="var(--chart-1)"
      layers={3}
      style={{ height: 220 }}
    />
  );
}
