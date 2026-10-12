import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The dashboard's glass card with a small uppercase title.
export default function Card({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("glass min-w-0 p-4", className)}>
      {title && (
        <h2 className="mb-2 px-1 font-mono text-[0.72rem] font-medium uppercase tracking-[0.06em] text-ink-faint">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
