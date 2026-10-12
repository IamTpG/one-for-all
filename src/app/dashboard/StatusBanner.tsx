import { loadStatus } from "@/lib/dashboardData";
import type { CheckLevel } from "@/lib/dashboardStatus";
import { cn } from "@/lib/utils";

const DOT: Record<CheckLevel, string> = {
  ok: "bg-ok ring-ok/25",
  warn: "bg-warn ring-warn/25",
  bad: "bg-danger ring-danger/25",
};

// One sentence on whether anything needs attention, plus a chip per check.
export default async function StatusBanner() {
  const status = await loadStatus();

  return (
    <div role="status" className="glass flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="flex items-center gap-2.5 text-sm font-semibold text-ink">
        <span className={cn("size-2.5 shrink-0 rounded-full ring-[3px]", DOT[status.level])} />
        {status.verdict}
      </div>
      <ul className="ml-auto flex flex-wrap gap-1.5">
        {status.checks.map((check) => (
          <li
            key={check.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-sunken px-2.5 py-0.5 text-xs text-ink-muted"
          >
            <span className={cn("size-1.5 rounded-full", DOT[check.level].split(" ")[0])} />
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
