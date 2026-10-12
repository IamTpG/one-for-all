import { GROQ_LIMITS } from "@/lib/config";
import { loadGroqUsage, loadUpstashUsage } from "@/lib/dashboardData";
import { formatTs } from "@/lib/format";
import styles from "../Dashboard.module.css";
import Meter from "../Meter";
import UpstashSection from "../UpstashSection";
import UsageChart from "../UsageChart";

const n = (value: number) => value.toLocaleString("en-US");

// Everything about staying inside the Groq and Upstash free-plan limits.
export default async function LimitsTab() {
  const [groq, upstash] = await Promise.all([loadGroqUsage(), loadUpstashUsage()]);

  return (
    <>
      <section className={styles.section}>
        <h2 className={`${styles.sectionTitle} mono`}>Groq Usage</h2>
        <Meter
          label="Tokens today (UTC)"
          value={groq.today.tokens}
          total={GROQ_LIMITS.tokensPerDay}
          displayText={`${n(groq.today.tokens)} / ${n(GROQ_LIMITS.tokensPerDay)}`}
        />
        <Meter
          label="Requests today (UTC)"
          value={groq.today.requests}
          total={GROQ_LIMITS.requestsPerDay}
          displayText={`${n(groq.today.requests)} / ${n(GROQ_LIMITS.requestsPerDay)}`}
        />
        <div className={styles.statGrid}>
          <div className={styles.statTile}>
            <span className={styles.statValue}>{groq.rate?.remainingRequests ?? "—"}</span>
            <span className={styles.statLabel}>Requests left today (per Groq)</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>{groq.rate?.remainingTokens ?? "—"}</span>
            <span className={styles.statLabel}>Tokens left this minute (per Groq)</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>{groq.rate ? formatTs(groq.rate.ts) : "—"}</span>
            <span className={styles.statLabel}>Last Groq call</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>{groq.today.rateLimited}</span>
            <span className={styles.statLabel}>Rate-limited (429) today</span>
          </div>
        </div>
        <UsageChart
          mode="requests"
          title="Requests"
          points={groq.points}
          nowMs={groq.nowMs}
          limitPerMinute={GROQ_LIMITS.requestsPerMinute}
          limitLabel={`Rate limit ${GROQ_LIMITS.requestsPerMinute}/min`}
        />
        <UsageChart
          mode="tokens"
          title="Total tokens"
          points={groq.points}
          nowMs={groq.nowMs}
          limitPerMinute={GROQ_LIMITS.tokensPerMinute}
          limitLabel={`Rate limit ${n(GROQ_LIMITS.tokensPerMinute)}/min`}
        />
        <p className={styles.emptyState}>
          Counted by this app from Groq responses since this feature was deployed; other projects sharing the same
          Groq organization are not included. Daily totals use the UTC day.
        </p>
      </section>

      <UpstashSection result={upstash} />
    </>
  );
}
