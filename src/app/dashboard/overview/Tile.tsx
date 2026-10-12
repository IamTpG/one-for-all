import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "default" | "warn" | "bad";

// One number with a caption; the tone colours the number when it needs attention.
export default function Tile({ value, label, tone = "default" }: { value: ReactNode; label: ReactNode; tone?: Tone }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[10px] bg-surface-sunken px-3 py-2">
      <span className={cn("text-lg font-bold text-ink", tone === "warn" && "text-warn", tone === "bad" && "text-danger")}>
        {value}
      </span>
      <span className="text-xs text-ink-faint">{label}</span>
    </div>
  );
}
