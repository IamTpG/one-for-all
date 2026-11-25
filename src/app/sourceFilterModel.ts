// Pure logic of the source filter dropdown: what a click selects, how the
// trigger and the "Đang lọc" chips read, and which saved value wins on load.
// Relative imports with extensions so it runs under `node --test`.

import { allOptionIds, type FilterOptions } from "../lib/sourceRegistry.ts";

export type SourceGroupId = "official" | "community";
export type GroupState = "none" | "some" | "all";

// Cleans a list of ids from the URL, storage or a saved state against the
// options on offer: unknown ids are dropped, duplicates collapse, the order
// follows the dropdown, and a selection that covers every option is the
// same as no filter ([]).
export function normaliseSources(ids: unknown, options: FilterOptions): string[] {
  if (!Array.isArray(ids)) return [];
  const known = allOptionIds(options);
  const wanted = new Set(ids.filter((id): id is string => typeof id === "string"));
  const selected = known.filter((id) => wanted.has(id));
  return selected.length === known.length ? [] : selected;
}
const normalise = normaliseSources;

export function groupState(selected: readonly string[], options: FilterOptions, group: SourceGroupId): GroupState {
  const ids = options[group].map((option) => option.id);
  const on = ids.filter((id) => selected.includes(id)).length;
  if (ids.length > 0 && on === ids.length) return "all";
  return on > 0 ? "some" : "none";
}

// With no source selected the filter is "everything", so the first click on
// an option narrows to just that option, not to everything but it.
export function toggleOption(selected: readonly string[], id: string, options: FilterOptions): string[] {
  const next = selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id];
  return normalise(next, options);
}

// A group checkbox selects its whole group unless it already is whole, in
// which case it clears it; the partial state selects the rest.
export function toggleGroup(selected: readonly string[], group: SourceGroupId, options: FilterOptions): string[] {
  const ids = options[group].map((option) => option.id);
  const state = groupState(selected, options, group);
  const next =
    state === "all"
      ? selected.filter((id) => !ids.includes(id))
      : [...selected.filter((id) => !ids.includes(id)), ...ids];
  return normalise(next, options);
}

export type TriggerLabels = { all: string; allOfficial: string; community: string };

function optionName(options: FilterOptions, id: string): string {
  return [...options.official, ...options.community].find((option) => option.id === id)?.name ?? id;
}

// "Mọi nguồn" | "Anthropic" | "Anthropic +1" | "Tất cả chính thức" | "Cộng đồng & báo chí".
export function triggerLabel(selected: readonly string[], options: FilterOptions, labels: TriggerLabels): string {
  if (selected.length === 0) return labels.all;
  if (selected.length === 1) return optionName(options, selected[0]);
  const official = options.official.map((option) => option.id);
  const community = options.community.map((option) => option.id);
  const sameSet = (ids: string[]) => ids.length === selected.length && ids.every((id) => selected.includes(id));
  if (sameSet(official)) return labels.allOfficial;
  if (sameSet(community)) return labels.community;
  return `${optionName(options, selected[0])} +${selected.length - 1}`;
}

export type SelectionChip = { key: string; label: string; ids: string[] };

// One chip per selected option; a whole group collapses into one chip that
// removes the whole group. A group with a single option is just that option.
export function selectionChips(selected: readonly string[], options: FilterOptions, labels: TriggerLabels): SelectionChip[] {
  const chips: SelectionChip[] = [];
  const groups: [SourceGroupId, string][] = [
    ["official", labels.allOfficial],
    ["community", labels.community],
  ];
  for (const [group, label] of groups) {
    const ids = options[group].map((option) => option.id);
    const picked = ids.filter((id) => selected.includes(id));
    if (picked.length === 0) continue;
    if (picked.length === ids.length && ids.length > 1) {
      chips.push({ key: `group:${group}`, label, ids });
    } else {
      for (const id of picked) chips.push({ key: id, label: optionName(options, id), ids: [id] });
    }
  }
  return chips;
}

export function removeIds(selected: readonly string[], ids: readonly string[], options: FilterOptions): string[] {
  return normalise(selected.filter((id) => !ids.includes(id)), options);
}

// ---------- Where the filter comes from on load ----------

// `?sources=anthropic,openai`; null when the parameter is absent.
export function parseSourcesParam(raw: string | null): string[] | null {
  if (raw === null) return null;
  return raw.split(",").map((part) => part.trim()).filter(Boolean);
}

export function sourcesParam(selected: readonly string[]): string {
  return selected.join(",");
}

export function parseStoredSources(raw: string): string[] {
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
}

// The URL wins over the saved value, even when it names nothing known (an
// all-unknown list means "no filter", it does not fall back to storage).
// A value that came from the URL is never written to storage by this
// module; the caller saves only when the reader changes the filter.
export function resolveSources(
  urlParam: string | null,
  stored: readonly string[],
  options: FilterOptions
): { sources: string[]; fromUrl: boolean } {
  const fromUrl = parseSourcesParam(urlParam);
  if (fromUrl !== null) return { sources: normalise(fromUrl, options), fromUrl: true };
  return { sources: normalise(stored, options), fromUrl: false };
}
