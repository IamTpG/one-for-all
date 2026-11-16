"use client";

import { useLanguage } from "../../LanguageProvider";
import world from "../../world.module.css";
import { articleCopy } from "./articleCopy";
import { ArticleTopBar, Pending } from "./ArticleParts";
import styles from "./Article.module.css";

// Shown while the item and its source content load: the real top bar and
// the ink masthead, with one hairline in it saying the page is working.
// No skeleton blocks.
export default function ArticleLoading() {
  const { language } = useLanguage();
  return (
    <div className={world.world}>
      <ArticleTopBar onInk />
      <main id="article-main" className={styles.main} tabIndex={-1}>
        <section className={styles.masthead}>
          <div className={styles.mastInner}>
            <Pending label={articleCopy(language).opening} />
          </div>
        </section>
      </main>
    </div>
  );
}
