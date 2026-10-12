export const DASHBOARD_TABS = [
  { id: "overview", label: "Overview" },
  { id: "limits", label: "Limits" },
  { id: "activity", label: "Activity" },
] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number]["id"];

// `?tab=` is untrusted input: anything unknown falls back to the overview.
export function parseTab(value: string | string[] | undefined): DashboardTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return DASHBOARD_TABS.find((tab) => tab.id === raw)?.id ?? "overview";
}
