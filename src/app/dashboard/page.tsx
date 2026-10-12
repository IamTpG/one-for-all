import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isOwnerRequest, OWNER_COOKIE_NAME } from "@/lib/ownerAuth";
import PageHeader from "../PageHeader";
import ThemeToggle from "../ThemeToggle";
import styles from "./Dashboard.module.css";
import StatusBanner from "./StatusBanner";
import TabNav from "./TabNav";
import ActivityTab from "./tabs/ActivityTab";
import LimitsTab from "./tabs/LimitsTab";
import OverviewTab from "./tabs/OverviewTab";
import { parseTab } from "./tabs";

// A thin shell: owner check, the status banner, the tab bar, and the one tab
// named by `?tab=` (each tab loads only its own data).
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const cookieStore = await cookies();
  if (!isOwnerRequest(cookieStore.get(OWNER_COOKIE_NAME)?.value)) {
    redirect("/owner-login");
  }

  const tab = parseTab((await searchParams).tab);

  return (
    <div className={styles.page}>
      <PageHeader tagline="DASHBOARD" actions={<ThemeToggle />} />

      <main className={styles.content}>
        <StatusBanner />
        <TabNav active={tab} />
        {tab === "overview" && <OverviewTab />}
        {tab === "limits" && <LimitsTab />}
        {tab === "activity" && <ActivityTab />}
      </main>
    </div>
  );
}
