"use client";

import { useRef, useState } from "react";
import { formatAxis, monotonePath, niceMax } from "@/lib/chartUtils";
import styles from "./Dashboard.module.css";

export type ChartSeries = { name: string; values: number[]; tone: "primary" | "secondary" };

type Props = {
  title: string;
  kind: "bar" | "stackedBar" | "line";
  // Smooth the line with a monotone curve (kind "line" only). Display only —
  // the tooltip still shows the real values.
  smooth?: boolean;
  // One entry per x position: the tooltip heading, and the x-axis label
  // (null = no label at that position).
  headings: string[];
  tickLabels: (string | null)[];
  series: ChartSeries[];
  formatValue: (n: number) => string;
  formatAxisValue?: (n: number) => string;
  showTotal?: boolean;
  // A dashed limit line. Drawn only once the data reaches LIMIT_VISIBLE_RATIO
  // of it; below that it would just flatten the data against the bottom of
  // the chart, so the legend says "off-scale" instead.
  limit?: { value: number; label: string };
  note?: string;
};

const LIMIT_VISIBLE_RATIO = 0.05;

const WIDTH = 600;
const HEIGHT = 200;
const PAD_LEFT = 46;
const PAD_RIGHT = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;

export default function SeriesChart({
  title,
  kind,
  smooth = false,
  headings,
  tickLabels,
  series,
  formatValue,
  formatAxisValue = formatAxis,
  showTotal = false,
  limit,
  note,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const n = headings.length;
  if (n === 0) {
    return (
      <div className={styles.usageChart}>
        <div className={styles.usageHeader}>
          <span className={styles.usageTitle}>{title}</span>
        </div>
        <p className={styles.emptyState}>No data yet.</p>
      </div>
    );
  }

  const totalAt = (i: number) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0);
  const dataMax = Math.max(
    0,
    ...(kind === "stackedBar"
      ? headings.map((_, i) => totalAt(i))
      : series.flatMap((s) => s.values))
  );
  const showLimit = !!limit && dataMax >= limit.value * LIMIT_VISIBLE_RATIO;
  const { max: yMax, step } = niceMax(Math.max(dataMax, showLimit ? limit.value : 0) * 1.08);
  const tickCount = Math.round(yMax / step);

  const slot = PLOT_WIDTH / n;
  const barWidth = Math.max(slot * 0.7, 0.8);
  const baseline = PAD_TOP + PLOT_HEIGHT;
  const yOf = (v: number) => baseline - (v / yMax) * PLOT_HEIGHT;
  const xCenter = (i: number) => PAD_LEFT + (i + 0.5) * slot;

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const idx = Math.floor((relX - PAD_LEFT) / slot);
    setHoverIndex(idx >= 0 && idx < n ? idx : null);
  }

  const tooltipLeftPct =
    hoverIndex === null ? 0 : Math.min(88, Math.max(12, (xCenter(hoverIndex) / WIDTH) * 100));

  return (
    <div className={styles.usageChart}>
      <div className={styles.usageHeader}>
        <span className={styles.usageTitle}>{title}</span>
      </div>

      <div className={styles.usageLegend}>
        {series.map((s) => (
          <span key={s.name} className={styles.legendItem}>
            <span
              className={`${styles.legendSwatch} ${s.tone === "primary" ? styles.usageBarPrimary : styles.usageBarSecondary}`}
            />{" "}
            {s.name}
          </span>
        ))}
        {limit && (
          <span className={styles.legendItem}>
            <span className={styles.legendDash} /> {limit.label}
            {showLimit ? "" : " (off-scale)"}
          </span>
        )}
        {note && <span className={styles.legendNote}>{note}</span>}
      </div>

      <div className={styles.usageChartWrap}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className={styles.usageSvg}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
          role="img"
          aria-label={title}
        >
          {Array.from({ length: tickCount + 1 }, (_, k) => k * step).map((v) => (
            <g key={v}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yOf(v)} y2={yOf(v)} className={styles.usageGrid} />
              <text x={PAD_LEFT - 6} y={yOf(v) + 3} textAnchor="end" className={styles.usageAxisLabel}>
                {formatAxisValue(v)}
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

          {kind === "line"
            ? series.map((s) => {
                const pts = s.values.map((v, i) => ({ x: xCenter(i), y: yOf(v) }));
                const d = smooth
                  ? monotonePath(pts)
                  : pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
                return (
                  <path
                    key={s.name}
                    d={d}
                    className={s.tone === "primary" ? styles.seriesLinePrimary : styles.seriesLineSecondary}
                  />
                );
              })
            : headings.map((_, i) => {
                let stackTop = 0;
                return (
                  <g key={i}>
                    {series.map((s) => {
                      const v = s.values[i] ?? 0;
                      if (v <= 0) return null;
                      const bottom = kind === "stackedBar" ? stackTop : 0;
                      stackTop = bottom + v;
                      return (
                        <rect
                          key={s.name}
                          x={xCenter(i) - barWidth / 2}
                          y={yOf(bottom + v)}
                          width={barWidth}
                          height={yOf(bottom) - yOf(bottom + v)}
                          className={s.tone === "primary" ? styles.usageBarPrimary : styles.usageBarSecondary}
                        />
                      );
                    })}
                  </g>
                );
              })}

          {kind === "line" &&
            hoverIndex !== null &&
            series.map((s) => (
              <circle
                key={s.name}
                cx={xCenter(hoverIndex)}
                cy={yOf(s.values[hoverIndex] ?? 0)}
                r={3.5}
                className={s.tone === "primary" ? styles.seriesDotPrimary : styles.seriesDotSecondary}
              />
            ))}

          {showLimit && limit && (
            <>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={yOf(limit.value)}
                y2={yOf(limit.value)}
                className={styles.usageLimitLine}
              />
              <text x={WIDTH - PAD_RIGHT} y={yOf(limit.value) - 4} textAnchor="end" className={styles.usageLimitLabel}>
                {formatAxisValue(limit.value)}
              </text>
            </>
          )}

          {tickLabels.map((label, i) =>
            label ? (
              <text key={i} x={xCenter(i)} y={HEIGHT - 6} textAnchor="middle" className={styles.usageAxisLabel}>
                {label}
              </text>
            ) : null
          )}
        </svg>

        {hoverIndex !== null && (
          <div className={styles.chartTooltip} style={{ left: `${tooltipLeftPct}%` }}>
            <div className={styles.chartTooltipLabel}>{headings[hoverIndex]}</div>
            {series.map((s) => (
              <div key={s.name} className={styles.chartTooltipValue}>
                {s.name} {formatValue(s.values[hoverIndex] ?? 0)}
              </div>
            ))}
            {showTotal && series.length > 1 && (
              <div className={styles.chartTooltipLabel}>Total {formatValue(totalAt(hoverIndex))}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
