"use client";

import { SankeyChart } from "@/components/charts/sankey/sankey-chart";
import { SankeyLink } from "@/components/charts/sankey/sankey-link";
import { SankeyNode } from "@/components/charts/sankey/sankey-node";
import { SankeyTooltip } from "@/components/charts/sankey/sankey-tooltip";
import type { SankeyInput } from "@/lib/activityData";

const SOURCE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

// Sources on the left, whether their items were new or already stored on the right.
export default function SourceSankey({ data }: { data: SankeyInput }) {
  const getNodeColor = (node: { name?: string }, index: number) =>
    node.name === "New" ? "var(--ok)" : node.name === "Already stored" ? "var(--text-faint)" : SOURCE_COLORS[index % SOURCE_COLORS.length];

  return (
    <SankeyChart
      data={data}
      aspectRatio="2.4 / 1"
      margin={{ top: 12, right: 110, bottom: 12, left: 110 }}
      nodePadding={14}
    >
      <SankeyLink getNodeColor={getNodeColor} />
      <SankeyNode getNodeColor={getNodeColor} valueUnit="items" />
      <SankeyTooltip />
    </SankeyChart>
  );
}
