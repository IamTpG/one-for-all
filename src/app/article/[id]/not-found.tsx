"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { resolveLocalized } from "@/lib/language";
import { useSaved } from "../../feedState";
import { useLanguage } from "../../LanguageProvider";
import world from "../../world.module.css";
import { articleCopy } from "./articleCopy";
import { displayTitle } from "./articleModel";
import { ArticleActions, ArticleTopBar } from "./ArticleParts";
import styles from "./Article.module.css";

// The item aged out of the feed (or never existed). If this browser saved
// it, its snapshot still has enough to read the gist and reach the source.
export default function ArticleNotFound() {
  const { language } = useLanguage();
  const copy = articleCopy(language);
  const pathname = usePathname();
  const saved = useSaved();

  const snapshot = useMemo(() => {
    const raw = pathname?.split("/article/")[1];
    if (!raw) return null;
    let id: string;
    try {
      id = decodeURIComponent(raw);
    } catch {
      return null;
    }
    return saved.find((item) => item.id === id) ?? null;
  }, [pathname, saved]);

  if (snapshot) {
    const summary = resolveLocalized(snapshot.summary, snapshot.summaryVi, language);
    return (
      <div className={world.world}>
        <ArticleTopBar />
        <main id="article-main" className={styles.page} tabIndex={-1}>
          <article className={styles.article}>
            <header className={styles.header}>
              <h1 className={styles.title}>{displayTitle(snapshot, language)}</h1>
              {summary.text && <p className={styles.standfirst}>{summary.text}</p>}
              <p className={styles.meta}>
                {snapshot.source} · {copy.date(new Date(snapshot.publishedAt))}
              </p>
              <ArticleActions item={snapshot} />
            </header>
            <p className={styles.bodyNote}>{copy.savedExpiredNote}</p>
          </article>
        </main>
      </div>
    );
  }

  return (
    <div className={world.world}>
      <ArticleTopBar />
      <main id="article-main" className={styles.page} tabIndex={-1}>
        <div className={styles.article}>
          <div className={styles.missing}>
            <h1 className={styles.missingTitle}>{copy.notFoundTitle}</h1>
            <p className={styles.missingNote}>{copy.notFoundNote(null)}</p>
            <div className={styles.missingAction}>
              <Link href="/" className={`${styles.pill} ${styles.pillInk}`}>
                {copy.notFoundAction}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
