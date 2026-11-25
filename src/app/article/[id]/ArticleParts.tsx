"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowUpRightIcon, BackIcon, BookmarkIcon } from "@/lib/icons";
import { resolveLocalized, type Language } from "@/lib/language";
import { PUBLISHERS } from "@/lib/sourceRegistry";
import type { FeedItem } from "@/lib/types";
import { primaryTopic } from "../../feedModel";
import { markSeen, toggleSaved, trackVisitActivity, useSaved } from "../../feedState";
import { homeCopy } from "../../homeCopy";
import { useLanguage } from "../../LanguageProvider";
import LanguageToggle from "../../LanguageToggle";
import ThemeToggle from "../../ThemeToggle";
import world from "../../world.module.css";
import { articleCopy } from "./articleCopy";
import {
  displayTitle,
  hnThreadUrl,
  MIN_TOC_SECTIONS,
  pointsAtRepo,
  sourceName,
  type ArticleItem,
} from "./articleModel";
import styles from "./Article.module.css";

// ---------- Top bar ----------

// `onInk` sets it inside the article masthead; plain is for pages without
// one (not found).
export function ArticleTopBar({ onInk = false }: { onInk?: boolean }) {
  const { language } = useLanguage();
  const copy = articleCopy(language);
  return (
    <>
      <a href="#article-main" className={world.skipLink}>
        {copy.skip}
      </a>
      <header className={onInk ? styles.topOnInk : styles.top}>
        <div className={clsx(world.container, world.topInner)}>
          {/* A real link: the feed restores its own scroll and filters
              from session storage when it mounts again. */}
          <Link href="/" scroll={false} className={clsx(world.brand, styles.back)} aria-label={copy.backLabel}>
            <BackIcon className={styles.backIcon} />
            {copy.back}
          </Link>
          <div className={world.topActions}>
            <LanguageToggle className={world.pillButton} />
            <ThemeToggle
              className={world.inkButton}
              labels={{ toDark: copy.themeToDark, toLight: copy.themeToLight }}
            />
          </div>
        </div>
      </header>
    </>
  );
}

// ---------- Masthead ----------

// The article opens on one full-bleed ink block: the top bar (rendered
// just above it with `onInk`, outside <main>), title, standfirst, metadata,
// actions and the figures that size the read. The reading surface below
// stays white.
export function ArticleMasthead({
  item,
  readMinutes,
  sections,
  hasBody,
}: {
  item: ArticleItem;
  readMinutes: number | null;
  sections: number;
  hasBody: boolean;
}) {
  const { language } = useLanguage();
  const copy = articleCopy(language);
  const home = homeCopy(language);

  // Opening the article is what "seen" means on the feed, and reading it
  // keeps the reader's visit alive.
  useEffect(() => {
    markSeen([item.id]);
    return trackVisitActivity();
  }, [item.id]);

  const title = displayTitle(item, language);
  const summary = resolveLocalized(item.summary, item.summaryVi, language);
  const pendingVi =
    language === "vi" && ((item.sourceType !== "github-release" && !item.titleVi) || (item.summary && !item.summaryVi));

  // Releases without notes are legitimately empty; every other source
  // should have had a body to extract.
  const summaryOnly = !hasBody && !item.videoEmbedHtml && item.sourceType !== "github-release";
  const minutes = item.videoEmbedHtml ? null : (item.lengthMinutes ?? readMinutes);
  const showSections = sections >= MIN_TOC_SECTIONS;

  const topic = primaryTopic(item as FeedItem);
  const thread = hnThreadUrl(item);
  const showThread = thread !== null && thread !== item.url;
  const parts: string[] = [];
  // An official update opens with its publisher and kind (no "official"
  // label); anything else with its topic.
  const officialKind = item.official?.kind;
  const publisher = officialKind ? (PUBLISHERS[item.official!.publisher]?.name ?? item.official!.publisher) : null;
  if (publisher && officialKind) parts.push(publisher, home.kinds[officialKind]);
  else if (topic && home.topicShort[topic]) parts.push(home.topicShort[topic]);
  if (sourceName(item) !== publisher) parts.push(sourceName(item));
  parts.push(copy.date(new Date(item.publishedAt)));
  if (item.videoEmbedHtml) parts.push(copy.video);
  // HN points and stars stay in this small line: the triage found they
  // never decided anything, so they get no big figure.
  if (item.points && item.sourceType === "hn") parts.push(copy.hnPoints(item.points));
  if (item.points && item.sourceType === "github-trending") parts.push(copy.stars(item.points));

  return (
    <section className={styles.masthead}>
      {/* Same width as what sits below: the contents grid when there are
          contents, the reading column otherwise. */}
      <header className={clsx(styles.mastInner, showSections && styles.mastInnerWide)}>
        <h1 className={styles.title}>{title}</h1>
        {summary.text && <Standfirst text={summary.text} />}
        {summaryOnly && summary.text && <p className={styles.mastNote}>{copy.summaryOnly}</p>}
        {pendingVi && copy.titlePending && <p className={styles.mastNote}>{copy.titlePending}</p>}
        <p className={styles.meta}>
          {/* Each part stays on one line; the space between parts is the
              only break, and the dot ends the part before it so a wrapped
              line never starts with one. */}
          {/* Narrow screens: the figures lead the line instead of taking a
              row of their own (hidden from 720px, where the row shows). */}
          {(minutes || showSections) && (
            <span className={styles.metaFigures}>
              {minutes && (
                <span className={styles.metaFigure}>
                  <b>{minutes}</b> {copy.statMinutes} ·
                </span>
              )}
              {minutes && showSections && " "}
              {showSections && (
                <span className={styles.metaFigure}>
                  <b>{sections}</b> {copy.statSections} ·
                </span>
              )}{" "}
            </span>
          )}
          {parts.map((part, index) => (
            <Fragment key={index}>
              {index > 0 && " "}
              <span>
                {part}
                {(index < parts.length - 1 || showThread) && " ·"}
              </span>
            </Fragment>
          ))}
          {showThread && (
            <>
              {" "}
              <a href={thread} target="_blank" rel="noopener noreferrer" className={styles.metaLink}>
                {copy.hnDiscussion}
              </a>
            </>
          )}
        </p>
        <div className={styles.mastFoot}>
          {(minutes || showSections) && (
            <dl className={styles.stats}>
              {minutes && (
                <div>
                  <dt>{copy.statMinutes}</dt>
                  <dd>{minutes}</dd>
                </div>
              )}
              {showSections && (
                <div>
                  <dt>{copy.statSections}</dt>
                  <dd>{sections}</dd>
                </div>
              )}
            </dl>
          )}
          <ArticleActions item={item} />
        </div>
      </header>
    </section>
  );
}

// ---------- Standfirst ----------

// Narrow screens clamp the summary to four lines so the actions reach the
// first screen; the full text stays one tap away, and the toggle appears
// only when the clamp actually cuts something.
function Standfirst({ text }: { text: string }) {
  const { language } = useLanguage();
  const copy = articleCopy(language);
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setClipped(node.scrollHeight > node.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);

  return (
    <>
      <p ref={ref} className={clsx(styles.standfirst, !expanded && styles.standfirstClamped)}>
        {text}
      </p>
      {(clipped || expanded) && (
        <button
          type="button"
          className={styles.standfirstToggle}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? copy.standfirstLess : copy.standfirstMore}
        </button>
      )}
    </>
  );
}

// ---------- Actions ----------

export function SaveButton({ item, className }: { item: ArticleItem; className?: string }) {
  const { language } = useLanguage();
  const copy = articleCopy(language);
  const saved = useSaved();
  const isSaved = useMemo(() => saved.some((entry) => entry.id === item.id), [saved, item.id]);
  return (
    <button
      type="button"
      className={clsx(styles.pill, className)}
      aria-pressed={isSaved}
      title={isSaved ? copy.unsaveLabel : copy.saveLabel}
      onClick={() => toggleSaved(item as FeedItem)}
    >
      <BookmarkIcon filled={isSaved} className={styles.pillIcon} />
      {isSaved ? copy.saved : copy.save}
    </button>
  );
}

export function OriginalLink({ item, ink = false }: { item: ArticleItem; ink?: boolean }) {
  const { language } = useLanguage();
  const copy = articleCopy(language);
  return (
    <a
      className={clsx(styles.pill, ink && styles.pillInk)}
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {pointsAtRepo(item) ? copy.openRepo : copy.original[item.sourceType]}
      <ArrowUpRightIcon className={styles.pillIcon} />
    </a>
  );
}

// A real link to the feed, which restores its own scroll and filters.
// Ink when it is the end of the article's main action, plain beside an
// ink "read the original".
export function BackToFeed({ ink = false, className }: { ink?: boolean; className?: string }) {
  const { language } = useLanguage();
  const copy = articleCopy(language);
  return (
    <Link href="/" scroll={false} className={clsx(styles.pill, ink && styles.pillInk, className)}>
      <BackIcon className={styles.pillIcon} />
      {copy.backToFeed}
    </Link>
  );
}

export function ArticleActions({ item }: { item: ArticleItem }) {
  return (
    <div className={styles.actions}>
      <OriginalLink item={item} />
      <SaveButton item={item} />
    </div>
  );
}

export function ArticleEnd({ item }: { item: ArticleItem }) {
  const { language } = useLanguage();
  const copy = articleCopy(language);
  return (
    <footer className={styles.end}>
      <p className={styles.endSource}>
        {copy.sourceLabel}: <span className={styles.endSourceName}>{sourceName(item)}</span>
      </p>
      <div className={clsx(styles.actions, styles.endActions)}>
        <BackToFeed ink className={styles.endBack} />
        <OriginalLink item={item} />
        <SaveButton item={item} />
      </div>
    </footer>
  );
}

// ---------- Media ----------

// Logos and icons upscaled to the column read as broken; same floor as the
// feed's lead image.
const MEDIA_MIN_WIDTH = 640;

export function ArticleImage({ src }: { src: string }) {
  const [state, setState] = useState<"loading" | "shown" | "rejected">("loading");
  const settle = (node: HTMLImageElement) =>
    setState(node.naturalWidth >= MEDIA_MIN_WIDTH ? "shown" : "rejected");
  if (state === "rejected") return null;
  return (
    <figure className={clsx(styles.media, state === "shown" && styles.mediaShown)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        // An image that finished before hydration never fires onLoad.
        ref={(node) => {
          if (node?.complete && state === "loading") {
            if (node.naturalWidth === 0) setState("rejected");
            else settle(node);
          }
        }}
        onLoad={(event) => settle(event.currentTarget)}
        onError={() => setState("rejected")}
      />
    </figure>
  );
}

// ---------- Translation continuation ----------

// Re-renders the page on the server, which translates the next batch of
// chunks. The current text stays in place until the new one arrives.
export function ContinueTranslation({ retry }: { retry: boolean }) {
  const router = useRouter();
  const { language } = useLanguage();
  const copy = articleCopy(language);
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={clsx(styles.pill, styles.pillInk)}
      disabled={pending}
      aria-busy={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? copy.continuing : retry ? copy.retryTranslation : copy.continueTranslation}
    </button>
  );
}

// ---------- Waiting states ----------

export function Pending({ label, note }: { label: string; note?: string }) {
  return (
    <div className={styles.pending} role="status">
      <span className={styles.pendingRule} aria-hidden="true" />
      <p className={styles.pendingLabel}>{label}</p>
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}

export function BodyPending({ language }: { language: Language }) {
  const copy = articleCopy(language);
  return language === "vi" ? (
    <Pending label={copy.translating} note={copy.translatingNote} />
  ) : (
    <Pending label={copy.loadingBody} />
  );
}
