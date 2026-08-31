import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getFeedItemById } from "@/lib/aggregate";
import { TOPICS } from "@/lib/config";
import { extractArticle } from "@/lib/extract";
import { GithubIcon, HnIcon, ReleaseIcon, RssIcon } from "@/lib/icons";
import { LANGUAGE_COOKIE, parseLanguageCookie, resolveLocalized, VI_NOT_READY_MESSAGE } from "@/lib/language";
import { getSiteSettings } from "@/lib/siteSettings";
import { getArticleTranslation } from "@/lib/translate";
import LanguageToggle from "../../LanguageToggle";
import ThemeToggle from "../../ThemeToggle";
import BackButton from "./BackButton";
import styles from "./Article.module.css";

const ICONS = {
  rss: RssIcon,
  hn: HnIcon,
  "github-trending": GithubIcon,
  "github-release": ReleaseIcon,
} as const;

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { watchedRepos } = await getSiteSettings();
  const item = await getFeedItemById(decodeURIComponent(id), watchedRepos);
  if (!item) notFound();

  const cookieStore = await cookies();
  const language = parseLanguageCookie(cookieStore.get(LANGUAGE_COOKIE)?.value);

  const contentHtml =
    item.fullContentHtml ??
    (item.sourceType === "rss" || item.sourceType === "hn"
      ? await extractArticle(item.url)
      : null);

  // Translated on first paint, same as extractArticle above — no loading
  // spinner. If contentHtml is null, there's nothing to translate; that
  // failure is unrelated to language and is handled by the existing
  // "couldn't load" fallback below, untouched.
  const translatedBody =
    language === "vi" && contentHtml ? await getArticleTranslation(item.id, contentHtml) : null;
  const bodyTranslationNote = language === "vi" && contentHtml && !translatedBody;

  const title = resolveLocalized(item.title, item.titleVi, language).text ?? item.title;
  const localizedSummary = resolveLocalized(item.summary, item.summaryVi, language);

  const Icon = ICONS[item.sourceType];
  const date = new Date(item.publishedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <BackButton />
          <div className={styles.topbarActions}>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className={styles.article}>
        <div className={styles.meta}>
          <Icon className={styles.sourceIcon} />
          <span className="mono">{item.source.toUpperCase()}</span>
          <div className={styles.dotSep} />
          <span className="mono">{date}</span>
        </div>

        {item.tag && <span className={`${styles.tagBadge} mono`}>{item.tag}</span>}

        <h1 className={`${styles.headline} display`}>{title}</h1>

        {item.topics && item.topics.length > 0 && (
          <div className={styles.topicRow}>
            {item.topics.map((topicId) => {
              const topic = TOPICS.find((t) => t.id === topicId);
              if (!topic) return null;
              return (
                <span key={topicId} className={`${styles.topicPill} mono`}>
                  {topic.label}
                </span>
              );
            })}
          </div>
        )}

        {item.videoEmbedHtml ? (
          <div className={styles.videoEmbed} dangerouslySetInnerHTML={{ __html: item.videoEmbedHtml }} />
        ) : (
          item.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className={styles.heroImage} />
          )
        )}

        {item.aiSummary && localizedSummary.text && (
          <div className={styles.aiSummaryBox}>
            <span className={`${styles.aiBadge} mono`}>AI Summary</span>
            <p>{localizedSummary.text}</p>
            {localizedSummary.note && <p className={styles.fallbackNote}>{localizedSummary.note}</p>}
          </div>
        )}

        {contentHtml ? (
          <>
            {bodyTranslationNote && <p className={styles.fallbackNote}>{VI_NOT_READY_MESSAGE}</p>}
            <div
              className={styles.body}
              dangerouslySetInnerHTML={{ __html: translatedBody ?? contentHtml }}
            />
          </>
        ) : (
          <div className={styles.body}>
            {item.summary && !item.aiSummary && <p>{item.summary}</p>}
            <p className={styles.fallbackNote}>
              Couldn&apos;t load the full article for this one.
            </p>
          </div>
        )}

        <a className={styles.openOriginal} href={item.url} target="_blank" rel="noopener noreferrer">
          Open the original
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.openIcon}>
            <path d="M7 17 L17 7" />
            <path d="M9 7h8v8" />
          </svg>
        </a>
      </main>
    </div>
  );
}
