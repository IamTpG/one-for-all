import type { ReactNode } from "react";

// A <details> card for the lower-priority dashboard sections: collapsed by
// default so the Activity tab stays short, no client JavaScript needed.
export default function Collapsible({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="glass group px-4">
      <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-xs font-bold uppercase tracking-wider text-ink-muted [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          {count !== undefined && <span className="ml-2 font-mono text-ink-faint">{count}</span>}
        </span>
        <span aria-hidden className="text-base leading-none text-ink-faint group-open:hidden">+</span>
        <span aria-hidden className="hidden text-base leading-none text-ink-faint group-open:inline">−</span>
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}
