"use client";

import { useMemo, useRef, useState } from "react";
import { formatAxis, formatCount, formatTime, ictParts, niceMax } from "@/lib/chartUtils";
import type { GroqUsagePoint } from "@/lib/usage";
import styles from "./Dashboard.module.css";

type Range = "1h" | "6h" | "24h";

// 24h charts are grouped into 5-minute buckets so the bars stay readable
// (1,440 one-minute bars would be hairlines); the rate-limit line scales
// with the bucket so it always means "the most this bucket could hold".
const RANGES: Record<Range, { minutes: number; bucketMinutes: number; labelEveryMinutes: number }> = {
  "1h": { minutes: 60, bucketMinutes: 1, labelEveryMinutes: 10 },
  "6h": { minutes: 360, bucketMinutes: 1, labelEveryMinutes: 60 },
  "24h": { minutes: 1440, bucketMinutes: 5, labelEveryMinutes: 240 },
};

const WIDTH = 600;
const HEIGHT = 200;
const PAD_LEFT = 42;
const PAD_RIGHT = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;

type Bucket = { t: number; req: number; input: number; output: number; limited: number };

type Props = {
  mode: "requests" | "tokens";
  title: string;
  points: GroqUsagePoint[];
  nowMs: number;
  limitPerMinute: number;
  limitLabel: string;
};

export default function UsageChart({ mode, title, points, nowMs, limitPerMinute, limitLabel }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [range, setRange] = useState<Range>("1h");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { minutes, bucketMinutes, labelEveryMinutes } = RANGES[range];
  const bucketMs = bucketMinutes * 60_000;
  const bucketCount = minutes / bucketMinutes;

  const buckets = useMemo<Bucket[]>(() => {
    const end = Math.floor(nowMs / bucketMs) * bucketMs;
    const start = end - (bucketCount - 1) * bucketMs;
    const result: Bucket[] = Array.from({ length: bucketCount }, (_, i) => ({
      t: start + i * bucketMs,
      req: 0,
      input: 0,
      output: 0,
      limited: 0,
    }));
    for (const p of points) {
      const idx = Math.floor((p.t - start) / bucketMs);
      if (idx < 0 || idx >= bucketCount) continue;
      result[idx].req += p.req;
      result[idx].input += p.input;
      result[idx].output += p.output;
      result[idx].limited += p.limited;
    }
    return result;
  }, [points, nowMs, bucketMs, bucketCount]);

  const valueOf = (b: Bucket) => (mode === "requests" ? b.req : b.input + b.output);
  const limit = limitPerMinute * bucketMinutes;
  const dataMax = Math.max(0, ...buckets.map(valueOf));
  const { max: yMax, step } = niceMax(Math.max(limit, dataMax) * 1.05, 1);
  const isEmpty = dataMax === 0;

  const slot = PLOT_WIDTH / bucketCount;
  const barWidth = Math.max(slot * 0.78, 0.8);
  const yOf = (v: number) => PAD_TOP + PLOT_HEIGHT - (v / yMax) * PLOT_HEIGHT;
  const xOf = (i: number) => PAD_LEFT + i * slot + (slot - barWidth) / 2;

  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += step) yTicks.push(v);

  const xLabels = buckets.flatMap((b, i) => {
    const { minuteOfDay } = ictParts(b.t);
    return minuteOfDay % labelEveryMinutes === 0 ? [{ i, text: formatTime(b.t) }] : [];
  });

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const idx = Math.floor((relX - PAD_LEFT) / slot);
    setHoverIndex(idx >= 0 && idx < bucketCount ? idx : null);
  }

  const hovered = hoverIndex !== null ? buckets[hoverIndex] : null;
  const hoverCenter = hoverIndex !== null ? PAD_LEFT + hoverIndex * slot + slot / 2 : 0;
  const tooltipLeftPct = Math.min(88, Math.max(12, (hoverCenter / WIDTH) * 100));

  return (
    <div className={styles.usageChart}>
      <div className={styles.usageHeader}>
        <span className={styles.usageTitle}>{title}</span>
        <div className={styles.rangeButtons} role="group" aria-label="Time range">
          {(Object.keys(RANGES) as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`${styles.rangeButton} ${r === range ? styles.rangeButtonActive : ""}`}
              onClick={() => {
                setRange(r);
                setHoverIndex(null);
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.usageLegend}>
        {mode === "tokens" ? (
          <>
            <span className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.usageBarPrimary}`} /> Input
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.usageBarSecondary}`} /> Output
            </span>
          </>
        ) : (
          <span className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.usageBarPrimary}`} /> Requests
          </span>
        )}
        {mode === "requests" && (
          <span className={styles.legendItem}>
            <span className={styles.legendLimited} /> Rate-limited (429)
          </span>
        )}
        <span className={styles.legendItem}>
          <span className={styles.legendDash} /> {limitLabel}
          {bucketMinutes > 1 ? ` × ${bucketMinutes}` : ""}
        </span>
        {bucketMinutes > 1 && <span className={styles.legendNote}>{bucketMinutes}-minute buckets · ICT</span>}
        {bucketMinutes === 1 && <span className={styles.legendNote}>per minute · ICT</span>}
      </div>

      <div className={styles.usageChartWrap}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className={styles.usageSvg}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
          role="img"
          aria-label={`${title} over the last ${range}, with the rate limit`}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yOf(v)} y2={yOf(v)} className={styles.usageGrid} />
              <text x={PAD_LEFT - 6} y={yOf(v) + 3} textAnchor="end" className={styles.usageAxisLabel}>
                {formatAxis(v)}
              </text>
            </g>
          ))}

          {hoverIndex !== null && (
            <rect
              x={PAD_LEFT + hoverIndex * slot}
              y={PAD_TOP}
              width={slot}
              height={PLOT_HEIGHT}
              className={styles.usageHoverBand}
            />
          )}

          {buckets.map((b, i) => {
            if (mode === "requests") {
              if (b.req === 0) return null;
              return (
                <rect
                  key={b.t}
                  x={xOf(i)}
                  y={yOf(b.req)}
                  width={barWidth}
                  height={PAD_TOP + PLOT_HEIGHT - yOf(b.req)}
                  className={styles.usageBarPrimary}
                />
              );
            }
            if (b.input + b.output === 0) return null;
            const inputTop = yOf(b.input);
            const totalTop = yOf(b.input + b.output);
            return (
              <g key={b.t}>
                <rect
                  x={xOf(i)}
                  y={inputTop}
                  width={barWidth}
                  height={PAD_TOP + PLOT_HEIGHT - inputTop}
                  className={styles.usageBarPrimary}
                />
                <rect
                  x={xOf(i)}
                  y={totalTop}
                  width={barWidth}
                  height={inputTop - totalTop}
                  className={styles.usageBarSecondary}
                />
              </g>
            );
          })}

          {mode === "requests" &&
            buckets.map((b, i) =>
              b.limited > 0 ? (
                <circle
                  key={`limited-${b.t}`}
                  cx={PAD_LEFT + i * slot + slot / 2}
                  cy={PAD_TOP + 4}
                  r={3}
                  className={styles.usageLimitedMark}
                />
              ) : null
            )}

          <line
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={yOf(limit)}
            y2={yOf(limit)}
            className={styles.usageLimitLine}
          />
          <text x={WIDTH - PAD_RIGHT} y={yOf(limit) - 4} textAnchor="end" className={styles.usageLimitLabel}>
            {formatAxis(limit)}
          </text>

          {xLabels.map(({ i, text }) => (
            <text
              key={i}
              x={PAD_LEFT + i * slot + slot / 2}
              y={HEIGHT - 6}
              textAnchor="middle"
              className={styles.usageAxisLabel}
            >
              {text}
            </text>
          ))}

          {isEmpty && (
            <text x={PAD_LEFT + PLOT_WIDTH / 2} y={PAD_TOP + PLOT_HEIGHT / 2} textAnchor="middle" className={styles.usageAxisLabel}>
              No Groq calls in this period
            </text>
          )}
        </svg>

        {hovered && (
          <div className={styles.chartTooltip} style={{ left: `${tooltipLeftPct}%` }}>
            <div className={styles.chartTooltipLabel}>
              {bucketMinutes > 1 ? `${formatTime(hovered.t)}–${formatTime(hovered.t + bucketMs)}` : formatTime(hovered.t)} ICT
            </div>
            {mode === "requests" ? (
              <>
                <div className={styles.chartTooltipValue}>{formatCount(hovered.req)} requests</div>
                {hovered.limited > 0 && (
                  <div className={styles.chartTooltipLabel}>{formatCount(hovered.limited)} rate-limited (429)</div>
                )}
              </>
            ) : (
              <>
                <div className={styles.chartTooltipValue}>Total {formatCount(hovered.input + hovered.output)}</div>
                <div className={styles.chartTooltipLabel}>Input {formatCount(hovered.input)}</div>
                <div className={styles.chartTooltipLabel}>Output {formatCount(hovered.output)}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
