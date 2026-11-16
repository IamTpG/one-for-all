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

// Sticky contents beside the body on wide screens, a disclosure above it
// on narrow ones. The current section and the minutes left follow scroll.
export default function ArticleToc({
  headings,
  totalMinutes,
  bodyId,
}: {
  headings: TocHeading[];
  totalMinutes: number | null;
  bodyId: string;
}) {
  const { language } = useLanguage();
  const copy = articleCopy(language);
  const [active, setActive] = useState(headings[0]?.id ?? null);
  const [left, setLeft] = useState(totalMinutes);

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      // At the very bottom the last sections can never reach the line, so
      // the last heading on screen counts instead.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const line = atBottom ? window.innerHeight : READ_LINE_PX;
      let current = headings[0]?.id ?? null;
      for (const heading of headings) {
        const node = document.getElementById(heading.id);
        if (node && node.getBoundingClientRect().top <= line) current = heading.id;
      }
      setActive(current);
      const body = document.getElementById(bodyId);
      if (body && totalMinutes) {
        const rect = body.getBoundingClientRect();
        const read = Math.min(1, Math.max(0, (window.innerHeight * 0.5 - rect.top) / rect.height));
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

  const list = (onPick?: (event: MouseEvent<HTMLAnchorElement>) => void) => (
    <ol className={styles.tocList}>
      {headings.map((heading) => (
        <li key={heading.id}>
          <a
            href={`#${heading.id}`}
            className={clsx(styles.tocLink, active === heading.id && styles.tocLinkActive)}
            aria-current={active === heading.id ? "location" : undefined}
            onClick={onPick}
          >
            {heading.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <nav className={styles.toc} aria-label={copy.tocTitle}>
        <div className={styles.tocSticky}>
          <p className={styles.tocTitle}>{copy.tocTitle}</p>
          {list()}
          {left !== null && <p className={styles.tocLeft}>{copy.minutesLeft(left)}</p>}
        </div>
      </nav>
      <details className={styles.tocMobile}>
        <summary className={styles.tocSummary}>
          {copy.tocToggle(headings.length)}
          <ChevronIcon className={styles.tocChevron} />
        </summary>
        {/* Picking a section closes the list so the heading is in view. */}
        {list((event) => event.currentTarget.closest("details")?.removeAttribute("open"))}
      </details>
    </>
  );
}
