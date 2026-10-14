import { formatBytes } from "@/lib/chartUtils";
import { GROQ_LIMITS, UPSTASH_LIMITS } from "@/lib/config";
import { loadGroqUsage, loadUpstashUsage } from "@/lib/dashboardData";
import { formatAgo } from "@/lib/format";
import { Card, Tile } from "../overview";
import UsageBar from "../overview/UsageBar";
import GroqCharts from "../limits/GroqCharts";
import UpstashCharts from "../limits/UpstashCharts";

const n = (value: number) => value.toLocaleString("en-US");

// Everything about staying inside the Groq and Upstash free-plan limits.
export default async function LimitsTab() {
  const [groq, upstash] = await Promise.all([loadGroqUsage(), loadUpstashUsage()]);

  return (
    <div className="flex flex-col gap-3">
      <Card title="Groq">
        <div className="mb-3 flex flex-col gap-2">
          <UsageBar
            label="Tokens today (UTC)"
            value={groq.today.tokens}
            total={GROQ_LIMITS.tokensPerDay}
            text={`${n(groq.today.tokens)} / ${n(GROQ_LIMITS.tokensPerDay)}`}
          />
          <UsageBar
            label="Requests today (UTC)"
            value={groq.today.requests}
            total={GROQ_LIMITS.requestsPerDay}
            text={`${n(groq.today.requests)} / ${n(GROQ_LIMITS.requestsPerDay)}`}
          />
        </div>
        <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
          <Tile value={groq.rate?.remainingRequests ?? "—"} label="Requests left today (per Groq)" />
          <Tile value={groq.rate?.remainingTokens ?? "—"} label="Tokens left this minute (per Groq)" />
          <Tile value={groq.rate ? formatAgo(groq.rate.ts) : "—"} label="Last Groq call" />
          <Tile value={groq.today.rateLimited} label="Rate-limited (429) today" tone={groq.today.rateLimited > 0 ? "warn" : "default"} />
        </div>
        <GroqCharts
          points={groq.points}
          nowMs={groq.nowMs}
          requestsPerMinute={GROQ_LIMITS.requestsPerMinute}
          tokensPerMinute={GROQ_LIMITS.tokensPerMinute}
        />
        <p className="mt-3 px-1 text-xs text-ink-faint">
          Counted by this app from Groq responses since this feature was deployed; other projects sharing the same
          Groq organization are not included. Daily totals use the UTC day.
        </p>
      </Card>

      {upstash.status === "error" && (
        <Card title="Upstash">
          <p className="px-1 text-sm text-ink-faint">Upstash usage unavailable: {upstash.message}</p>
        </Card>
      )}

      {upstash.status === "ok" && (
        <Card title="Upstash">
          <div className="mb-3 flex flex-col gap-2">
            <UsageBar
              label="Bandwidth this month"
              value={upstash.data.bandwidth.monthBytes}
              total={UPSTASH_LIMITS.bandwidthBytesPerMonth}
              text={`${formatBytes(upstash.data.bandwidth.monthBytes)} / ${formatBytes(UPSTASH_LIMITS.bandwidthBytesPerMonth)}`}
            />
            <UsageBar
              label="Data size"
              value={upstash.data.dataSize.currentBytes}
              total={UPSTASH_LIMITS.dataSizeBytes}
              text={`${formatBytes(upstash.data.dataSize.currentBytes)} / ${formatBytes(UPSTASH_LIMITS.dataSizeBytes)}`}
            />
          </div>
          <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
            <Tile
              value={upstash.data.bandwidth.projectedMonthBytes === null ? "—" : formatBytes(upstash.data.bandwidth.projectedMonthBytes)}
              label={
                upstash.data.bandwidth.projectedMonthBytes === null
                  ? "Projected month-end bandwidth (needs a day of data)"
                  : `Projected month-end bandwidth (${((upstash.data.bandwidth.projectedMonthBytes / UPSTASH_LIMITS.bandwidthBytesPerMonth) * 100).toFixed(1)}% of limit)`
              }
            />
            <Tile
              value={upstash.data.throughput.latestPerSec.toFixed(2)}
              label={`Commands/sec, last-minute average (limit ${n(UPSTASH_LIMITS.commandsPerSecond)})`}
            />
            <Tile value={n(upstash.data.requests.daily.at(-1)?.value ?? 0)} label="Requests today" />
            <Tile value={n(upstash.data.requests.monthTotal)} label="Requests this month" />
          </div>
          <UpstashCharts data={upstash.data} limits={UPSTASH_LIMITS} />
        </Card>
      )}
    </div>
  );
}
