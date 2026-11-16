"use client";

import { useEffect, useState, type MouseEvent } from "react";
import clsx from "clsx";
import { ChevronIcon } from "@/lib/icons";
import type { TocHeading } from "@/lib/headings";
import { useLanguage } from "../../LanguageProvider";
import { articleCopy } from "./articleCopy";
import styles from "./Article.module.css";

// A heading counts as "being read" once its top passes this line.
const READ_LINE_PX = 140;

// Past this many sections the sticky list shows a window around the current
// one instead of every entry.
const LONG_TOC = 15;
const WINDOW_AROUND = 3;

// Sticky contents beside the body on wide screens, a disclosure above it
// on narrow ones. The current section and the minutes left follow scroll.
export default function ArticleToc({
  headings,
  totalMinutes,
  bodyId,
  onPick,
}: {
  headings: TocHeading[];
  totalMinutes: number | null;
  bodyId: string;
  // Called when a section is picked, before the jump (the waiting state
  // uses it to put the English body on the page first).
  onPick?: () => void;
}) {
  const { language } = useLanguage();
  const copy = articleCopy(language);
  const [active, setActive] = useState(headings[0]?.id ?? null);
  const [left, setLeft] = useState(totalMinutes);
  const [showAll, setShowAll] = useState(false);
  const long = headings.length > LONG_TOC;
  // The EN tag only helps when the list mixes languages.
  const mixed =
    headings.some((heading) => heading.lang === "en") &&
    headings.some((heading) => !heading.lang);

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      // At the very bottom the last sections can never reach the line, so
      // the last heading on screen counts instead.
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      const line = atBottom ? window.innerHeight : READ_LINE_PX;
      let current = headings[0]?.id ?? null;
      for (const heading of headings) {
        const node = document.getElementById(heading.id);
        if (node && node.getBoundingClientRect().top <= line)
          current = heading.id;
      }
      setActive(current);
      const body = document.getElementById(bodyId);
      if (body && totalMinutes) {
        const rect = body.getBoundingClientRect();
        const read = Math.min(
          1,
          Math.max(0, (window.innerHeight * 0.5 - rect.top) / rect.height),
        );
        setLeft(Math.ceil(totalMinutes * (1 - read)));
      }
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [headings, totalMinutes, bodyId]);

  const activeIndex = Math.max(
    0,
    headings.findIndex((heading) => heading.id === active),
  );
  const list = (
    onPick?: (event: MouseEvent<HTMLAnchorElement>) => void,
    windowed = false,
  ) => (
    <ol className={styles.tocList}>
      {headings.map((heading, index) =>
        windowed && Math.abs(index - activeIndex) > WINDOW_AROUND ? null : (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={clsx(
                styles.tocLink,
                active === heading.id && styles.tocLinkActive,
              )}
              aria-current={active === heading.id ? "location" : undefined}
              onClick={onPick}
            >
              <span lang={heading.lang}>{heading.text}</span>
              {mixed && heading.lang === "en" && (
                <abbr className={styles.tocLang} title={copy.tocEnglish}>
                  EN
                </abbr>
              )}
            </a>
          </li>
        ),
      )}
    </ol>
  );

  return (
    <>
      <nav className={styles.toc} aria-label={copy.tocTitle}>
        <div className={styles.tocSticky}>
          <p className={styles.tocTitle}>{copy.tocTitle}</p>
          {list(() => onPick?.(), long && !showAll)}
          {long && (
            <button
              type="button"
              className={styles.tocMore}
              aria-expanded={showAll}
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll ? copy.tocLess : copy.tocAll(headings.length)}
            </button>
          )}
          {left !== null && (
            <p className={styles.tocLeft}>{copy.minutesLeft(left)}</p>
          )}
        </div>
      </nav>
      <details className={styles.tocMobile}>
        <summary className={styles.tocSummary}>
          {copy.tocToggle(headings.length)}
          <ChevronIcon className={styles.tocChevron} />
        </summary>
        {/* Picking a section closes the list so the heading is in view. */}
        {list((event) => {
          onPick?.();
          event.currentTarget.closest("details")?.removeAttribute("open");
        })}
      </details>
    </>
  );
}
