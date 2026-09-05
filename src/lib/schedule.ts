// Fetch times are stored as UTC "HH:MM" strings and displayed/edited on the
// settings page in fixed UTC+7 (Vietnam) — flat arithmetic, not a timezone
// library, since there's no DST to account for.
const ICT_OFFSET_MINUTES = 7 * 60;

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatMinutes(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function ictToUtc(hhmmIct: string): string {
  return formatMinutes(parseHHMM(hhmmIct) - ICT_OFFSET_MINUTES);
}

export function utcToIct(hhmmUtc: string): string {
  return formatMinutes(parseHHMM(hhmmUtc) + ICT_OFFSET_MINUTES);
}

export const DEFAULT_FETCH_TIMES_ICT = ["08:30", "12:30", "20:30"];
export const DEFAULT_FETCH_TIMES_UTC = DEFAULT_FETCH_TIMES_ICT.map(ictToUtc);

// Minutes elapsed since the most recent occurrence of `slotUtc` at or before
// `nowUtc` — 0 if the slot is right now, just under 1440 if its last
// occurrence was almost a full day ago. Wraps correctly across midnight.
function minutesSincePassed(nowUtc: Date, slotUtc: string): number {
  const nowMinutes = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();
  const slotMinutes = parseHHMM(slotUtc);
  return (((nowMinutes - slotMinutes) % 1440) + 1440) % 1440;
}

// The slot whose most recent occurrence is closest to now — i.e. the latest
// slot that's currently due. Ticking on this (guarded by markSlotRan) is
// what lets the cron catch up on exactly one fetch after downtime: if the
// server was down through one or more scheduled times, the next tick only
// runs the most recent of them, never replays the ones further back.
export function latestDueSlot(nowUtc: Date, slotsUtc: string[]): string | null {
  if (slotsUtc.length === 0) return null;
  return slotsUtc.reduce((latest, slot) =>
    minutesSincePassed(nowUtc, slot) < minutesSincePassed(nowUtc, latest) ? slot : latest
  );
}

// The slot whose next occurrence is soonest, and how many minutes until
// it's due — display-only, for the dashboard's "next scheduled fetch" tile.
export function nextScheduledSlot(
  nowUtc: Date,
  slotsUtc: string[]
): { slotUtc: string; minutesUntil: number } | null {
  if (slotsUtc.length === 0) return null;
  const minutesUntil = (slot: string) => (1440 - minutesSincePassed(nowUtc, slot)) % 1440 || 1440;
  return slotsUtc
    .map((slotUtc) => ({ slotUtc, minutesUntil: minutesUntil(slotUtc) }))
    .reduce((a, b) => (b.minutesUntil < a.minutesUntil ? b : a));
}

// The UTC calendar date this occurrence of the slot belongs to — used as
// part of the "has this slot already run" marker key. Rolls back to the
// previous day when a late-evening slot is being matched just after
// midnight (the wraparound case in isWithinSlot).
export function slotDateKey(nowUtc: Date, slotUtc: string): string {
  const nowMinutes = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();
  const slotMinutes = parseHHMM(slotUtc);
  const date = new Date(nowUtc);
  if (nowMinutes < slotMinutes) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
