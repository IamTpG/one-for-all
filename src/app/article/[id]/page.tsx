import { notFound } from "next/navigation";
import { getFeedItemById } from "@/lib/aggregate";
import { TOPICS } from "@/lib/config";
import { extractArticle } from "@/lib/extract";
import { GithubIcon, HnIcon, ReleaseIcon, RssIcon } from "@/lib/icons";
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
  const item = await getFeedItemById(decodeURIComponent(id));
  if (!item) notFound();

  const contentHtml =
    item.fullContentHtml ??
    (item.sourceType === "rss" || item.sourceType === "hn"
      ? await extractArticle(item.url)
      : null);

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
          <ThemeToggle />
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

        <h1 className={`${styles.headline} display`}>{item.title}</h1>

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

        {contentHtml ? (
          <div className={styles.body} dangerouslySetInnerHTML={{ __html: contentHtml }} />
        ) : (
          <div className={styles.body}>
            {item.summary && (
              <div className={styles.summaryRow}>
                {item.aiSummary && <span className={`${styles.aiBadge} mono`}>AI Summary</span>}
                <p>{item.summary}</p>
              </div>
            )}
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
