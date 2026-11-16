import { anchorSections, type TocHeading } from "@/lib/headings";
import type { Language } from "@/lib/language";
import { getArticleTranslation } from "@/lib/translate";
import { articleCopy } from "./articleCopy";
import { ContinueTranslation, OriginalLink } from "./ArticleParts";
import { MIN_TOC_SECTIONS, type ArticleItem } from "./articleModel";
import ArticleToc from "./ArticleToc";
import styles from "./Article.module.css";

function Prose({ html, lang }: { html: string; lang: Language }) {
  return <div className={styles.prose} lang={lang} dangerouslySetInnerHTML={{ __html: html }} />;
}

type Segment = { html: string; lang: Language };

// Anchors every section heading across the segments in reading order, so
// the contents list one numbering for the Vietnamese part and the English
// remainder alike.
function anchor(segments: Segment[]): { segments: Segment[]; headings: TocHeading[] } {
  const headings: TocHeading[] = [];
  const anchored = segments.map((segment) => {
    const result = anchorSections(segment.html, headings.length);
    headings.push(...result.headings);
    return { ...segment, html: result.html };
  });
  return { segments: anchored, headings };
}

// Streams in under its own Suspense boundary: the masthead is on screen
// while the body is translated. Renders two grid items: the contents (when
// the article has enough sections) and the body column.
export default async function ArticleBody({
  item,
  contentHtml,
  language,
  readMinutes,
  bodyId,
}: {
  item: ArticleItem;
  contentHtml: string | null;
  language: Language;
  readMinutes: number | null;
  bodyId: string;
}) {
  const copy = articleCopy(language);

  if (!contentHtml) {
    return (
      <div className={styles.bodyCol}>
        {item.sourceType === "github-release" ? (
          <p className={styles.bodyNote}>{copy.releaseEmpty}</p>
        ) : (
          <div className={styles.missing}>
            <p className={styles.missingTitle}>
              {item.sourceType === "github-trending" ? copy.readmeMissing : copy.noContentTitle}
            </p>
            {item.sourceType !== "github-trending" && <p className={styles.missingNote}>{copy.noContentNote}</p>}
            <div className={styles.missingAction}>
              <OriginalLink item={item} ink />
            </div>
          </div>
        )}
      </div>
    );
  }

  let lead: Segment[];
  let rest: Segment[] = [];
  let note: string | null = null;
  let handoff: { remaining: number; failed: boolean } | null = null;

  if (language !== "vi") {
    lead = [{ html: contentHtml, lang: "en" }];
  } else {
    const { parts, remaining, failed } = await getArticleTranslation(item.id, contentHtml);
    const translated = parts.filter((part) => part.translated);
    if (translated.length === 0) {
      lead = [{ html: contentHtml, lang: "en" }];
      note = copy.translationFailed;
    } else {
      lead = [{ html: translated.map((part) => part.html).join(""), lang: "vi" }];
      if (remaining > 0) {
        rest = [{ html: parts.filter((part) => !part.translated).map((part) => part.html).join(""), lang: "en" }];
        handoff = { remaining, failed };
      }
    }
  }

  const { segments, headings } = anchor([...lead, ...rest]);
  const [first, ...after] = segments;
  const translatedBody = language === "vi" && !note;

  return (
    <>
      {headings.length >= MIN_TOC_SECTIONS && (
        <ArticleToc headings={headings} totalMinutes={readMinutes} bodyId={bodyId} />
      )}
      <div className={styles.bodyCol} id={bodyId}>
        {note && <p className={styles.bodyNote}>{note}</p>}
        <Prose html={first.html} lang={first.lang} />
        {handoff && (
          <aside className={styles.handoff} aria-label={copy.partialLead(handoff.remaining)}>
            <p className={styles.handoffLead}>{copy.partialLead(handoff.remaining)}</p>
            <p className={styles.note}>{handoff.failed ? copy.partialFailed : copy.partialNote}</p>
            <div className={styles.handoffAction}>
              <ContinueTranslation retry={handoff.failed} />
            </div>
          </aside>
        )}
        {after.map((segment, index) => (
          <Prose key={index} html={segment.html} lang={segment.lang} />
        ))}
        {translatedBody && <p className={styles.bodyNote}>{copy.machineTranslated}</p>}
      </div>
    </>
  );
}
