import { TOPICS } from "@/lib/config";
import type { FetchRunRecord } from "@/lib/dashboardStats";
import type { FeedItem } from "@/lib/types";

export type Slice = { label: string; value: number };

// Largest slices first; the tail beyond `max` is folded into "Other" so a
// donut with twenty feeds stays readable.
export function topSlices(slices: Slice[], max: number): Slice[] {
  const sorted = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= max) return sorted;
  const rest = sorted.slice(max - 1).reduce((sum, s) => sum + s.value, 0);
  return [...sorted.slice(0, max - 1), { label: "Other", value: rest }];
}

export function itemsBySource(items: FeedItem[]): Slice[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
  return Array.from(counts, ([label, value]) => ({ label, value }));
}

// An item can carry several topics, so the slices add up to more than the item count.
export function itemsByTopic(items: FeedItem[]): Slice[] {
  const labelOf = new Map(TOPICS.map((topic) => [topic.id, topic.label]));
  const counts = new Map<string, number>();
  for (const item of items) {
    const topics = item.topics?.length ? item.topics : [null];
    for (const topic of topics) {
      const label = topic === null ? "Untagged" : (labelOf.get(topic) ?? topic);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return Array.from(counts, ([label, value]) => ({ label, value }));
}

// Store-wide stages, each a subset of the one before, so the funnel narrows honestly.
export function itemFunnel(items: FeedItem[], views: Map<string, number>): Slice[] {
  const summarised = items.filter((item) => item.aiSummary);
  const translated = summarised.filter((item) => item.titleVi && item.summaryVi);
  const opened = translated.filter((item) => (views.get(item.id) ?? 0) > 0);
  return [
    { label: "Stored", value: items.length },
    { label: "Summarised", value: summarised.length },
    { label: "Translated", value: translated.length },
    { label: "Opened", value: opened.length },
  ];
}

export type SankeyInput = {
  nodes: { name: string; category: "source" | "landing" }[];
  links: { source: number; target: number; value: number }[];
};

// Sources on the left, "New" / "Already stored" on the right, from one run.
// Returns null when the run predates per-source new counts.
export function runSankey(run: FetchRunRecord | null): SankeyInput | null {
  if (!run) return null;
  const sources = run.sources.filter((s) => s.count > 0);
  if (sources.length === 0 || sources.some((s) => s.newItems === undefined)) return null;

  const nodes: SankeyInput["nodes"] = [
    ...sources.map((s) => ({ name: s.label, category: "source" as const })),
    { name: "New", category: "landing" },
    { name: "Already stored", category: "landing" },
  ];
  const newIdx = sources.length;
  const oldIdx = sources.length + 1;
  const links: SankeyInput["links"] = [];
  sources.forEach((s, i) => {
    const fresh = s.newItems ?? 0;
    if (fresh > 0) links.push({ source: i, target: newIdx, value: fresh });
    if (s.count - fresh > 0) links.push({ source: i, target: oldIdx, value: s.count - fresh });
  });
  return { nodes, links };
}

export type DayCount = { date: string; count: number };
export type CalendarBin = { count: number; bin: number; date: Date };
export type CalendarColumn = { bin: number; bins: CalendarBin[] };

// Lays daily counts (oldest first, UTC dates) out as week columns of seven
// Sunday-first rows. Days outside the series become empty ghost cells.
export function toCalendarColumns(days: DayCount[]): CalendarColumn[] {
  if (days.length === 0) return [];
  const first = new Date(`${days[0].date}T00:00:00Z`);
  const byDate = new Map(days.map((d) => [d.date, d.count]));
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const last = new Date(`${days[days.length - 1].date}T00:00:00Z`);

  const columns: CalendarColumn[] = [];
  for (let weekStart = new Date(start); weekStart <= last; weekStart.setUTCDate(weekStart.getUTCDate() + 7)) {
    const bins: CalendarBin[] = [];
    for (let row = 0; row < 7; row++) {
      const day = new Date(weekStart);
      day.setUTCDate(day.getUTCDate() + row);
      const key = day.toISOString().slice(0, 10);
      bins.push({ bin: row, date: day, count: byDate.get(key) ?? 0 });
    }
    columns.push({ bin: columns.length, bins });
  }
  return columns;
}
