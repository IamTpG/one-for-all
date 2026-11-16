"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import clsx from "clsx";
import type { TocHeading } from "@/lib/headings";
import { useLanguage } from "../../LanguageProvider";
import { articleCopy } from "./articleCopy";
import { MIN_TOC_SECTIONS, type ArticleItem } from "./articleModel";
import { ArticleEnd } from "./ArticleParts";
import ArticleToc from "./ArticleToc";
import styles from "./Article.module.css";

// Which articles the reader chose to read in English while the Vietnamese
// body was still being translated. Kept for the tab's lifetime, so the
// choice survives the moment the translation streams in.
const choseEnglish = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setEnglish(itemId: string, on: boolean) {
  if (on) choseEnglish.add(itemId);
  else choseEnglish.delete(itemId);
  listeners.forEach((listener) => listener());
}

// Articles whose real body is mounted. The waiting shell unmounts then, so
// its copy of the English body (with the same section ids) leaves the page.
const arrived = new Set<string>();

function setArrived(itemId: string, on: boolean) {
  if (on) arrived.add(itemId);
  else arrived.delete(itemId);
  listeners.forEach((listener) => listener());
}

function useArrived(itemId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => arrived.has(itemId),
    () => false
  );
}

function useChoseEnglish(itemId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => choseEnglish.has(itemId),
    () => false
  );
}

function EnglishProse({ html }: { html: string }) {
  return <div className={styles.prose} lang="en" dangerouslySetInnerHTML={{ __html: html }} />;
}

// The Vietnamese body's waiting state. The contents come from the original's
// headings, so they match the masthead's section count from the start, and
// the original is one tap away instead of a blank wait.
//
// It is rendered beside the body's Suspense boundary, not as its fallback:
// React does not hydrate a fallback that is still waiting on the server, so
// its button would be dead. CSS hides this shell as soon as a body element
// ([data-article-body]) follows it, which also holds before hydration when
// the translation was cached and both arrive together.
export function PendingBody({
  itemId,
  headings,
  englishHtml,
  parts,
  minutes,
  bodyId,
}: {
  itemId: string;
  headings: TocHeading[];
  englishHtml: string;
  parts: number;
  minutes: number | null;
  bodyId: string;
}) {
  const { language } = useLanguage();
  const copy = articleCopy(language);
  const english = useChoseEnglish(itemId);
  const bodyArrived = useArrived(itemId);

  // A section picked in the contents before the English body existed: jump
  // to it once it is on the page.
  useEffect(() => {
    if (!english || bodyArrived || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [english, bodyArrived]);

  if (bodyArrived) return null;

  return (
    <div className={styles.pendingShell}>
      {headings.length >= MIN_TOC_SECTIONS && (
        <ArticleToc
          headings={headings}
          totalMinutes={minutes}
          bodyId={`${bodyId}-pending`}
          onPick={() => setEnglish(itemId, true)}
        />
      )}
      <div className={styles.bodyCol} id={`${bodyId}-pending`}>
        {english ? (
          <>
            <p className={styles.bodyNote} role="status">
              {copy.readingEnglishNote}
            </p>
            <EnglishProse html={englishHtml} />
          </>
        ) : (
          <div className={styles.pending} role="status">
            <span className={styles.pendingRule} aria-hidden="true" />
            <p className={styles.pendingLabel}>{copy.translating}</p>
            <p className={styles.note}>{parts > 1 ? copy.translatingLongNote(parts) : copy.translatingNote}</p>
            <button
              type="button"
              className={clsx(styles.pill, styles.pendingAction)}
              onClick={() => setEnglish(itemId, true)}
            >
              {copy.readEnglishNow}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export type TranslationOutcome = "full" | "partial" | "failed";

// Once the translation arrives: a reader who switched to the original keeps
// reading it (nothing moves under them) and is offered the Vietnamese body;
// everyone else simply gets the Vietnamese body.
export function TranslatedSwap({
  itemId,
  item,
  headings,
  englishHtml,
  outcome,
  minutes,
  bodyId,
  children,
}: {
  itemId: string;
  item: ArticleItem;
  headings: TocHeading[];
  englishHtml: string;
  outcome: TranslationOutcome;
  minutes: number | null;
  bodyId: string;
  children: ReactNode;
}) {
  const { language } = useLanguage();
  const copy = articleCopy(language);
  const english = useChoseEnglish(itemId);

  useEffect(() => {
    setArrived(itemId, true);
    return () => setArrived(itemId, false);
  }, [itemId]);

  if (!english) return <>{children}</>;

  const message =
    outcome === "full" ? copy.viReady : outcome === "partial" ? copy.viReadyPartial : copy.viFailedWhileEnglish;

  return (
    <>
      {headings.length >= MIN_TOC_SECTIONS && (
        <ArticleToc headings={headings} totalMinutes={minutes} bodyId={bodyId} />
      )}
      <div className={styles.bodyCol} id={bodyId} data-article-body>
        <aside className={styles.handoff} role="status">
          <p className={styles.handoffLead}>{message}</p>
          {outcome !== "failed" && (
            <div className={styles.handoffAction}>
              <button
                type="button"
                className={clsx(styles.pill, styles.pillInk)}
                onClick={() => {
                  setEnglish(itemId, false);
                  document.getElementById(bodyId)?.scrollIntoView();
                }}
              >
                {copy.switchToVi}
              </button>
            </div>
          )}
        </aside>
        <EnglishProse html={englishHtml} />
        <ArticleEnd item={item} />
      </div>
    </>
  );
}
