import { cache, Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { extractArticle } from "@/lib/extract";
import { countSections } from "@/lib/headings";
import { bodyHasImage, tidyBody } from "@/lib/images";
import { LANGUAGE_COOKIE, parseLanguageCookie } from "@/lib/language";
import { fetchRepoReadme, trendingRepo } from "@/lib/readme";
import { getSiteSettings } from "@/lib/siteSettings";
import { getStoredItemById } from "@/lib/store";
import type { FeedItem } from "@/lib/types";
import ViewTracker from "../../ViewTracker";
import world from "../../world.module.css";
import ArticleBody from "./ArticleBody";
import { ArticleEnd, ArticleImage, ArticleMasthead, ArticleTopBar, BodyPending } from "./ArticleParts";
import { displayTitle, MIN_TOC_SECTIONS, type ArticleItem } from "./articleModel";
import styles from "./Article.module.css";

// Translating a long article's next batch can take two Groq calls.
export const maxDuration = 60;

const getItem = cache(async (rawId: string): Promise<FeedItem | null> => {
  const { watchedRepos } = await getSiteSettings();
  return getStoredItemById(decodeURIComponent(rawId), watchedRepos);
});

async function loadContent(item: FeedItem): Promise<string | null> {
  if (item.fullContentHtml) return item.fullContentHtml;
  if (item.sourceType === "github-trending") {
    const repo = trendingRepo(item.id);
    return repo ? fetchRepoReadme(repo) : null;
  }
  if (item.sourceType === "rss" || item.sourceType === "hn") return extractArticle(item.url);
  return null;
}

// Words per minute for the "N min read" estimate; Vietnamese and English
// read at about the same rate by word count.
const WORDS_PER_MINUTE = 220;

function readingMinutes(html: string | null): number | null {
  if (!html) return null;
  const words = html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
  const minutes = Math.round(words / WORDS_PER_MINUTE);
  return minutes >= 2 ? minutes : null;
}

function toArticleItem(item: FeedItem): ArticleItem {
  return {
    id: item.id,
    source: item.source,
    sourceId: item.sourceId,
    sourceType: item.sourceType,
    title: item.title,
    titleVi: item.titleVi,
    url: item.url,
    summary: item.summary,
    summaryVi: item.summaryVi,
    publishedAt: item.publishedAt,
    imageUrl: item.imageUrl,
    videoEmbedHtml: item.videoEmbedHtml,
    topics: item.topics,
    tag: item.tag,
    points: item.points,
    firstSeenAt: item.firstSeenAt,
    lengthMinutes: item.lengthMinutes,
  };
}

export async function generateMetadata({ params }: PageProps<"/article/[id]">): Promise<Metadata> {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) return { title: "OneForAll" };
  const language = parseLanguageCookie((await cookies()).get(LANGUAGE_COOKIE)?.value);
  return { title: `${displayTitle(item, language)} · OneForAll` };
}

export default async function ArticlePage({ params }: PageProps<"/article/[id]">) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();

  const language = parseLanguageCookie((await cookies()).get(LANGUAGE_COOKIE)?.value);
  // Repeated images collapse to one, and empty leftovers go, before the
  // body is measured, translated or rendered.
  const contentHtml = tidyBody(await loadContent(item));
  const articleItem = toArticleItem(item);
  const minutes = readingMinutes(contentHtml);
  const sections = countSections(contentHtml);
  const hasToc = sections >= MIN_TOC_SECTIONS;
  // The listing image often is the article's own lead picture; when the
  // body already shows it, it is not repeated above the body.
  const showImage = Boolean(item.imageUrl) && !bodyHasImage(contentHtml, item.imageUrl);

  return (
    <div className={world.world}>
      <ViewTracker type="article" itemId={item.id} />
      <ArticleTopBar onInk />

      <main id="article-main" className={styles.main} tabIndex={-1}>
        <ArticleMasthead item={articleItem} readMinutes={minutes} sections={sections} />

        {/* Grid: contents on the left (when the article has enough
            sections), the reading column on the right. The contents come
            from the body, so they stream in with it. */}
        <div className={hasToc ? styles.layoutToc : styles.layout}>
          {item.videoEmbedHtml ? (
            <div className={styles.video} dangerouslySetInnerHTML={{ __html: item.videoEmbedHtml }} />
          ) : (
            showImage && item.imageUrl && <ArticleImage src={item.imageUrl} />
          )}

          {/* Keyed by language: switching VI/EN shows the waiting state
              instead of leaving the old language on screen while the
              server translates. */}
          <Suspense
            key={language}
            fallback={
              <div className={styles.bodyCol}>
                <BodyPending language={language} />
              </div>
            }
          >
            <ArticleBody
              item={articleItem}
              contentHtml={contentHtml}
              language={language}
              readMinutes={minutes}
              bodyId="article-body"
            />
          </Suspense>

          {/* Without a body the masthead's actions are the only ones
              needed; repeating them would put the original link on screen
              twice in a few hundred pixels. */}
          {contentHtml && <ArticleEnd item={articleItem} />}
        </div>
      </main>
    </div>
  );
}
