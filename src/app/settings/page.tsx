import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isOwnerRequest, OWNER_COOKIE_NAME } from "@/lib/ownerAuth";
import { buildSettingsGroups } from "@/lib/settingsGroups";
import { getSiteSettings } from "@/lib/siteSettings";
import { logoutAction } from "../actions/owner";
import ThemeToggle from "../ThemeToggle";
import WatchedReposEditor from "../WatchedReposEditor";
import controls from "../SettingsControls.module.css";
import BackButton from "./BackButton";
import FetchLimitsEditor from "./FetchLimitsEditor";
import FetchNowButton from "./FetchNowButton";
import ScheduleEditor from "./ScheduleEditor";
import styles from "./Settings.module.css";
import SourceToggles from "./SourceToggles";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  if (!isOwnerRequest(cookieStore.get(OWNER_COOKIE_NAME)?.value)) {
    redirect("/owner-login");
  }

  const settings = await getSiteSettings();
  const groups = buildSettingsGroups(settings.watchedRepos);

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <BackButton />
          <h1 className={`${styles.title} display`}>Settings</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className={styles.content}>
        <section className={styles.section}>
          <h2 className={`${styles.sectionTitle} mono`}>Sources</h2>
          <SourceToggles groups={groups} disabledFeeds={settings.disabledFeeds} />
        </section>

        <section className={styles.section}>
          <h2 className={`${styles.sectionTitle} mono`}>Watched Repos</h2>
          <WatchedReposEditor initialRepos={settings.watchedRepos} />
        </section>

        <section className={styles.section}>
          <h2 className={`${styles.sectionTitle} mono`}>Fetch Schedule</h2>
          <ScheduleEditor initialTimesUtc={settings.fetchTimesUtc} />
        </section>

        <section className={styles.section}>
          <h2 className={`${styles.sectionTitle} mono`}>Fetch Limits &amp; Retention</h2>
          <FetchLimitsEditor
            initialLimits={{
              rssItemLimit: settings.rssItemLimit,
              hnItemLimit: settings.hnItemLimit,
              githubTrendingLimit: settings.githubTrendingLimit,
              releasesPerRepo: settings.releasesPerRepo,
              anthropicItemLimit: settings.anthropicItemLimit,
            }}
            initialRetentionDays={settings.retentionDays}
          />
        </section>

        <section className={styles.section}>
          <h2 className={`${styles.sectionTitle} mono`}>Manual fetch</h2>
          <FetchNowButton />
        </section>

        <form action={logoutAction} className={controls.settingsGroup}>
          <button type="submit" className={controls.signOutButton}>
            Sign out
          </button>
        </form>
      </main>
    </div>
  );
}
