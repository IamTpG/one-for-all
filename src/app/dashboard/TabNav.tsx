import Link from "next/link";
import { cn } from "@/lib/utils";
import { DASHBOARD_TABS, type DashboardTab } from "./tabs";

// Plain links (the tab lives in the URL), so each tab is a server render that
// loads only its own data and can be bookmarked.
export default function TabNav({ active }: { active: DashboardTab }) {
  return (
    <nav aria-label="Dashboard sections" className="glass flex w-fit gap-1 p-1">
      {DASHBOARD_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={`/dashboard?tab=${tab.id}`}
            prefetch={false}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              isActive ? "bg-accent-soft text-ink" : "text-ink-muted hover:text-ink"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
