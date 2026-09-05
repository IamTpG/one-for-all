"use client";

import { useRef, useState } from "react";
import styles from "./Dashboard.module.css";

type Point = { date: string; count: number };

const WIDTH = 600;
const HEIGHT = 160;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 10;
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;

function formatShortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function ViewsLineChart({ data }: { data: Point[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) return null;

  const max = Math.max(1, ...data.map((d) => d.count));
  const points = data.map((d, i) => ({
    ...d,
    x: data.length > 1 ? PAD_LEFT + (i / (data.length - 1)) * PLOT_WIDTH : PAD_LEFT + PLOT_WIDTH / 2,
    y: PAD_TOP + PLOT_HEIGHT - (d.count / max) * PLOT_HEIGHT,
  }));
  const last = points[points.length - 1];

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${last.x.toFixed(1)} ${PAD_TOP + PLOT_HEIGHT} L ${points[0].x.toFixed(1)} ${PAD_TOP + PLOT_HEIGHT} Z`;

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className={styles.chartWrap}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className={styles.chartSvg}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
        role="img"
        aria-label={`Home page views over the last ${data.length} days`}
      >
        <path d={areaPath} className={styles.chartArea} />
        <path d={linePath} className={styles.chartLine} vectorEffect="non-scaling-stroke" />
        {hovered && (
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1={PAD_TOP}
            y2={PAD_TOP + PLOT_HEIGHT}
            className={styles.chartCrosshair}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 || i === hoverIndex ? 4 : 0}
            className={styles.chartDot}
          />
        ))}
        <text x={last.x} y={last.y - 8} className={styles.chartEndLabel} textAnchor="end">
          {last.count}
        </text>
      </svg>
      {hovered && (
        <div className={styles.chartTooltip} style={{ left: `${(hovered.x / WIDTH) * 100}%` }}>
          <div className={styles.chartTooltipValue}>{hovered.count}</div>
          <div className={styles.chartTooltipLabel}>{formatShortDate(hovered.date)}</div>
        </div>
      )}
    </div>
  );
}
