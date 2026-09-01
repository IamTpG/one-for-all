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

// True when `now` is at or up to `toleranceMinutes` after `slotUtc` (today's
// occurrence of it). Wraps correctly across midnight so a slot just before
// 00:00 UTC still matches a check that lands just after it.
export function isWithinSlot(nowUtc: Date, slotUtc: string, toleranceMinutes: number): boolean {
  const nowMinutes = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();
  const slotMinutes = parseHHMM(slotUtc);
  const diff = (((nowMinutes - slotMinutes) % 1440) + 1440) % 1440;
  return diff <= toleranceMinutes;
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
