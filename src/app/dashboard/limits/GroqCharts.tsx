"use client";

import { useMemo, useState } from "react";
import { ComposedChart } from "@/components/charts/composed-chart";
import { DateLabelFormatProvider } from "@/components/charts/date-label-format";
import { Grid } from "@/components/charts/grid";
import { Line } from "@/components/charts/line";
import { SeriesBar } from "@/components/charts/series-bar";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";
import { formatCount } from "@/lib/chartUtils";
import { bucketGroqUsage, GROQ_RANGES, type RangeKey } from "@/lib/usageBuckets";
import type { GroqUsagePoint } from "@/lib/usage";
import { cn } from "@/lib/utils";
import { CHART_MARGIN, ictTime, LIMIT_VISIBLE_RATIO, RateLimitMarkers } from "./chartBits";
import ChartKey, { type KeyItem } from "./ChartKey";

type Props = {
  points: GroqUsagePoint[];
  nowMs: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
};

function RangeToggle({ value, onChange }: { value: RangeKey; onChange: (range: RangeKey) => void }) {
  return (
    <div role="group" aria-label="Time range" className="inline-flex gap-0.5 rounded-lg border border-line p-0.5">
      {(Object.keys(GROQ_RANGES) as RangeKey[]).map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onChange(range)}
          className={cn(
            "rounded-md px-2.5 py-0.5 text-xs",
            range === value ? "bg-accent-soft font-bold text-ink" : "text-ink-muted hover:text-ink"
          )}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

// Groq requests and tokens per minute (5-minute buckets for 24h), each with its
// per-minute rate limit as a dashed line.
export default function GroqCharts({ points, nowMs, requestsPerMinute, tokensPerMinute }: Props) {
  const [range, setRange] = useState<RangeKey>("1h");

  const { data, bucketMinutes } = useMemo(() => {
    const { buckets, bucketMinutes } = bucketGroqUsage(points, nowMs, range);
    return {
      bucketMinutes,
      data: buckets.map((b) => ({
        date: new Date(b.t),
        requests: b.requests,
        input: b.input,
        output: b.output,
        limited: b.limited,
        requestsLimit: requestsPerMinute * bucketMinutes,
        tokensLimit: tokensPerMinute * bucketMinutes,
      })),
    };
  }, [points, nowMs, range, requestsPerMinute, tokensPerMinute]);

  const maxRequests = Math.max(0, ...data.map((d) => d.requests));
  const maxTokens = Math.max(0, ...data.map((d) => d.input + d.output));
  const showRequestsLimit = maxRequests >= requestsPerMinute * bucketMinutes * LIMIT_VISIBLE_RATIO;
  const showTokensLimit = maxTokens >= tokensPerMinute * bucketMinutes * LIMIT_VISIBLE_RATIO;
  const hasData = maxRequests > 0;
  const barWidth = bucketMinutes > 1 ? 8 : 10;
  const note = `${bucketMinutes > 1 ? `${bucketMinutes}-minute buckets` : "per minute"} · times in ICT`;
  const limitKey = (shown: boolean, text: string): KeyItem[] =>
    shown ? [{ label: `Rate limit ${text}${bucketMinutes > 1 ? ` × ${bucketMinutes}` : ""}`, color: "var(--danger)", shape: "dash" }] : [];

  return (
    <DateLabelFormatProvider value={ictTime}>
      <div className="flex flex-col gap-3">
        <div className="flex justify-end px-1">
          <RangeToggle value={range} onChange={setRange} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-line p-3">
            <h3 className="mb-1 px-1 text-sm font-bold text-ink">Requests</h3>
            <ChartKey
              items={[
                { label: "Requests", color: "var(--chart-1)", shape: "bar" },
                ...limitKey(showRequestsLimit, `${requestsPerMinute}/min`),
                ...(hasData ? [{ label: "429", color: "var(--danger)", shape: "dot" } as KeyItem] : []),
              ]}
            />
            <ComposedChart data={data} xDataKey="date" aspectRatio="auto" className="h-64" margin={CHART_MARGIN} barGap={0} maxBarSize={barWidth}>
              <Grid horizontal />
              <SeriesBar dataKey="requests" fill="var(--chart-1)" radius={2} />
              {showRequestsLimit && (
                <Line dataKey="requestsLimit" stroke="var(--danger)" strokeWidth={1.5} dashFromIndex={0} dashArray="6,4" showHighlight={false} />
              )}
              <RateLimitMarkers dataKey="limited" />
              <XAxis numTicks={6} />
              <YAxis numTicks={4} />
              <ChartTooltip
                showCrosshair={false}
                showDots={false}
                rows={(p) => [
                  { color: "var(--chart-1)", label: "Requests", value: formatCount(Number(p.requests)) },
                  ...(Number(p.limited) > 0
                    ? [{ color: "var(--danger)", label: "Rate-limited (429)", value: formatCount(Number(p.limited)) }]
                    : []),
                ]}
              />
            </ComposedChart>
            <p className="px-1 pt-1 text-xs text-ink-faint">
              {hasData ? "" : "No Groq calls in this period · "}
              {note}
            </p>
          </div>

          <div className="min-w-0 rounded-xl border border-line p-3">
            <h3 className="mb-1 px-1 text-sm font-bold text-ink">Total tokens</h3>
            <ChartKey
              items={[
                { label: "Input", color: "var(--chart-1)", shape: "bar" },
                { label: "Output", color: "var(--chart-3)", shape: "bar" },
                ...limitKey(showTokensLimit, `${formatCount(tokensPerMinute)}/min`),
              ]}
            />
            <ComposedChart data={data} xDataKey="date" aspectRatio="auto" className="h-64" margin={CHART_MARGIN} barGap={0} maxBarSize={barWidth} stacked>
              <Grid horizontal />
              <SeriesBar dataKey="input" fill="var(--chart-1)" />
              <SeriesBar dataKey="output" fill="var(--chart-3)" radius={2} />
              {showTokensLimit && (
                <Line dataKey="tokensLimit" stroke="var(--danger)" strokeWidth={1.5} dashFromIndex={0} dashArray="6,4" showHighlight={false} />
              )}
              <XAxis numTicks={6} />
              <YAxis numTicks={4} />
              <ChartTooltip
                showCrosshair={false}
                showDots={false}
                rows={(p) => [
                  { color: "var(--chart-1)", label: "Input", value: formatCount(Number(p.input)) },
                  { color: "var(--chart-3)", label: "Output", value: formatCount(Number(p.output)) },
                  { color: "var(--text-faint)", label: "Total", value: formatCount(Number(p.input) + Number(p.output)) },
                ]}
              />
            </ComposedChart>
            <p className="px-1 pt-1 text-xs text-ink-faint">
              {note}
            </p>
          </div>
        </div>
      </div>
    </DateLabelFormatProvider>
  );
}
