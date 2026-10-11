// Small helpers shared by the dashboard's SVG usage charts. Pure functions,
// no server-only imports, so client components can use them.

// The app shows times in fixed UTC+7 everywhere (see lib/schedule.ts).
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

export function ictParts(t: number): { hh: string; mm: string; minuteOfDay: number } {
  const d = new Date(t + ICT_OFFSET_MS);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return { hh: String(h).padStart(2, "0"), mm: String(m).padStart(2, "0"), minuteOfDay: h * 60 + m };
}

export function formatTime(t: number): string {
  const { hh, mm } = ictParts(t);
  return `${hh}:${mm}`;
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

// Compact axis label: 1500 -> "1.5k", 250 -> "250".
export function formatAxis(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${+(n / 1000).toFixed(1)}k`;
  return String(+n.toFixed(2));
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];

// 1024-based, matching how the Upstash console labels sizes (a 250,000,000
// byte limit shows there as "238.42 MB").
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unit]}`;
}

// Rounds a max up to 1/2/5 x 10^k so the axis ticks land on round numbers.
export function niceMax(value: number, minStep = 0): { max: number; step: number } {
  const target = value > 0 ? value : 1;
  const rough = target / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / magnitude;
  const stepBase = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = Math.max(minStep, stepBase * magnitude);
  return { max: Math.ceil(target / step) * step, step };
}

// SVG path through the points as a monotone cubic curve (Fritsch-Carlson):
// smooth, but never overshoots a data point, so a flat run of zeros stays
// flat instead of dipping below zero. x must be strictly increasing.
export function monotonePath(points: { x: number; y: number }[]): string {
  const n = points.length;
  if (n === 0) return "";
  const f = (v: number) => v.toFixed(1);
  if (n === 1) return `M ${f(points[0].x)} ${f(points[0].y)}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x);
    slope.push((points[i + 1].y - points[i].y) / dx[i]);
  }

  const tangent: number[] = new Array(n);
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      tangent[i] = tau * a * slope[i];
      tangent[i + 1] = tau * b * slope[i];
    }
  }

  let d = `M ${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d +=
      ` C ${f(points[i].x + h)} ${f(points[i].y + tangent[i] * h)}` +
      `, ${f(points[i + 1].x - h)} ${f(points[i + 1].y - tangent[i + 1] * h)}` +
      `, ${f(points[i + 1].x)} ${f(points[i + 1].y)}`;
  }
  return d;
}
