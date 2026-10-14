import { cn } from "@/lib/utils";

// "used / limit" as a labelled bar; amber at 70 %, red at 90 %.
export default function UsageBar({ label, value, total, text }: { label: string; value: number; total: number; text: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="px-1">
      <div className="mb-1 flex justify-between text-xs text-ink-muted">
        <span>{label}</span>
        <span className="font-mono">{text}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-line bg-surface-sunken">
        <div
          className={cn("h-full rounded-full", pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warn" : "bg-accent")}
          style={{ width: `${Math.max(pct, value > 0 ? 1 : 0)}%` }}
        />
      </div>
    </div>
  );
}
