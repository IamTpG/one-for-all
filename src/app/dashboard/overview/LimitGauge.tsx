import { Gauge } from "@/components/charts/gauge";
import Card from "./Card";

// Notch gauge for "used / limit". The arc fills 0-100 and turns amber / red at
// 70 / 90 %. Real usage is tiny next to these free-plan limits (a fraction of
// a percent), so any non-zero value lights at least the first notch.
export default function LimitGauge({
  name,
  percent,
  centerValue,
  centerSuffix,
  centerFractionDigits = 0,
  sub,
}: {
  name: string;
  percent: number;
  centerValue: number;
  centerSuffix?: string;
  centerFractionDigits?: number;
  sub: string;
}) {
  const fill = percent >= 90 ? "var(--danger)" : percent >= 70 ? "var(--warn)" : "var(--accent)";
  const shown = percent > 0 ? Math.max(percent, 2.5) : 0;

  return (
    <Card className="flex flex-col items-center gap-1 pb-3">
      <div className="w-full max-w-[200px]">
        <Gauge
          minWidth={0}
          value={Math.min(shown, 100)}
          centerValue={centerValue}
          suffix={centerSuffix}
          formatOptions={{ notation: "standard", maximumFractionDigits: centerFractionDigits }}
          defaultLabel={name}
          activeFill={fill}
          inactiveFillOpacity={0.4}
        />
      </div>
      <p className="text-center text-xs text-ink-faint">
        {percent < 1 ? percent.toFixed(2) : Math.round(percent)}% · {sub}
      </p>
    </Card>
  );
}
