"use client";

import { useState } from "react";

// An image that fails before hydration fires its error event before React
// is listening, so a ref also checks for one that already failed.
// A lead image must hold up at the lead's size: logos and small icons
// upscaled to a 16:10 frame read as broken, so they disqualify the lead.
const LEAD_MIN_WIDTH = 640;

function tooSmallForLead(node: HTMLImageElement): boolean {
  return node.naturalWidth < LEAD_MIN_WIDTH;
}

function leadImageRef(onReject: () => void) {
  return (node: HTMLImageElement | null) => {
    if (node && node.complete && tooSmallForLead(node)) onReject();
  };
}

function imageStateRef(onFail: () => void, onLoaded: () => void) {
  return (node: HTMLImageElement | null) => {
    if (!node || !node.complete) return;
    if (node.naturalWidth === 0) onFail();
    else onLoaded();
  };
}
import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRightIcon, BookmarkIcon, ChevronIcon } from "@/lib/icons";
import { resolveLocalized, VI_NOT_READY_MESSAGE, type Language } from "@/lib/language";
import type { FeedItem } from "@/lib/types";
import {
  isNewItem,
  primaryTopic,
  releaseVersion,
  repoDisplayName,
  timeAgo,
  type ReleaseGroup,
} from "./feedModel";
import { markSeen, toggleSaved } from "./feedState";
import type { HomeCopy } from "./homeCopy";
import styles from "./Feed.module.css";

export type RowContext = {
  copy: HomeCopy;
  language: Language;
  now: number;
  baseline: number | null;
  seen: ReadonlySet<string>;
  savedIds: ReadonlySet<string>;
  // Ids still in the store; a saved item that aged out links to its
  // original instead of a detail page that no longer exists.
  liveIds: ReadonlySet<string>;
  // In the New view every row is new, so the badge would only add noise.
  showNewBadge: boolean;
  onImageError: (id: string) => void;
};

function itemHref(item: FeedItem, ctx: RowContext): { href: string; external: boolean } {
  if (item.sourceType === "github-trending" || !ctx.liveIds.has(item.id)) {
    return { href: item.url, external: true };
  }
  return { href: `/article/${encodeURIComponent(item.id)}`, external: false };
}

function HeadlineLink({
  item,
  ctx,
  className,
  children,
  seenIds,
  tabIndex,
  ariaHidden,
}: {
  item: FeedItem;
  ctx: RowContext;
  className?: string;
  children: React.ReactNode;
  seenIds?: string[];
  tabIndex?: number;
  ariaHidden?: boolean;
}) {
  const { href, external } = itemHref(item, ctx);
  const onClick = () => markSeen(seenIds ?? [item.id]);
  const shared = { className, onClick, tabIndex, "aria-hidden": ariaHidden || undefined };
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...shared}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} {...shared}>
      {children}
    </Link>
  );
}

function Actions({ item, ctx, title }: { item: FeedItem; ctx: RowContext; title: string }) {
  const saved = ctx.savedIds.has(item.id);
  const { copy } = ctx;
  return (
    <span className={styles.actions}>
      <button
        type="button"
        className={styles.iconButton}
        aria-pressed={saved}
        aria-label={saved ? copy.unsave : copy.save}
        title={saved ? copy.unsave : copy.save}
        onClick={() => toggleSaved(item)}
      >
        <BookmarkIcon filled={saved} />
      </button>
      {item.sourceType !== "github-trending" && (
        <a
          className={styles.iconButton}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={copy.originalOf(title)}
          title={copy.original}
          onClick={() => markSeen([item.id])}
        >
          <ArrowUpRightIcon />
        </a>
      )}
    </span>
  );
}

function Meta({
  item,
  ctx,
  isNew,
  title,
  label,
}: {
  item: FeedItem;
  ctx: RowContext;
  isNew: boolean;
  title: string;
  label?: string;
}) {
  const { copy } = ctx;
  const topic = primaryTopic(item);
  const parts: string[] = [];
  const topicLabel = label ?? (topic ? copy.topicShort[topic] : undefined);
  if (topicLabel) parts.push(topicLabel);
  parts.push(item.sourceType === "github-release" ? (item.title.split(":")[0] ?? item.source) : item.source);
  parts.push(timeAgo(ctx.now, new Date(item.publishedAt).getTime(), copy));
  if (item.videoEmbedHtml) {
    parts.push(item.lengthMinutes ? copy.videoMinutes(item.lengthMinutes) : copy.video);
  } else if (item.lengthMinutes && item.lengthMinutes >= 8) {
    parts.push(copy.readMinutes(item.lengthMinutes));
  }
  if (item.coverageCount && item.coverageCount > 1) parts.push(copy.sourcesCount(item.coverageCount));

  return (
    <div className={styles.meta}>
      {isNew && ctx.showNewBadge && (
        <span className={styles.newBadge}>
          <span className={styles.newDot} aria-hidden="true" />
          {copy.newBadge}
        </span>
      )}
      <span className={styles.metaText}>{parts.join(" · ")}</span>
      <Actions item={item} ctx={ctx} title={title} />
    </div>
  );
}

function Summary({ item, ctx, className }: { item: FeedItem; ctx: RowContext; className?: string }) {
  const localized = resolveLocalized(item.summary, item.summaryVi, ctx.language);
  if (!localized.text) return null;
  return (
    <>
      <p className={clsx(styles.summary, className)}>{localized.text}</p>
      {localized.note === VI_NOT_READY_MESSAGE && ctx.copy.translationPending && (
        <p className={styles.note}>{ctx.copy.translationPending}</p>
      )}
    </>
  );
}

function Entities({ item }: { item: FeedItem }) {
  if (!item.entities || item.entities.length === 0) return null;
  return (
    <ul className={styles.entities}>
      {item.entities.map((entity) => (
        <li key={entity}>{entity}</li>
      ))}
    </ul>
  );
}

function localizedTitle(item: FeedItem, language: Language): string {
  return resolveLocalized(item.title, item.titleVi, language).text ?? item.title;
}

export function LeadStory({ item, ctx, withImage }: { item: FeedItem; ctx: RowContext; withImage: boolean }) {
  const title = localizedTitle(item, ctx.language);
  const isNew = isNewItem(item, ctx.baseline);
  const seen = ctx.seen.has(item.id);
  return (
    <article className={clsx(styles.lead, !withImage && styles.leadTextOnly, seen && styles.seen)}>
      {withImage && (
      <HeadlineLink item={item} ctx={ctx} className={styles.leadFigure} tabIndex={-1} ariaHidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt=""
          className={styles.leadImage}
          referrerPolicy="no-referrer"
          ref={leadImageRef(() => ctx.onImageError(item.id))}
          onLoad={(event) => {
            if (tooSmallForLead(event.currentTarget)) ctx.onImageError(item.id);
          }}
          onError={() => ctx.onImageError(item.id)}
        />
      </HeadlineLink>
      )}
      <div className={styles.leadBody}>
        <h2 className={styles.leadTitle}>
          <HeadlineLink item={item} ctx={ctx} className={styles.titleLink}>
            {title}
          </HeadlineLink>
        </h2>
        <Summary item={item} ctx={ctx} className={styles.leadSummary} />
        <Entities item={item} />
        <Meta item={item} ctx={ctx} isNew={isNew} title={title} />
      </div>
    </article>
  );
}

export function ItemRow({ item, ctx }: { item: FeedItem; ctx: RowContext }) {
  const title = localizedTitle(item, ctx.language);
  const isNew = isNewItem(item, ctx.baseline);
  const seen = ctx.seen.has(item.id);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const showImage = Boolean(item.imageUrl) && !imageFailed;
  return (
    <article className={clsx(styles.row, seen && styles.seen)}>
      <div className={clsx(showImage && styles.rowWithThumb)}>
        <div className={styles.rowBody}>
          <h2 className={styles.rowTitle}>
            <HeadlineLink item={item} ctx={ctx} className={styles.titleLink}>
              {title}
            </HeadlineLink>
          </h2>
          <Summary item={item} ctx={ctx} />
          <Entities item={item} />
        </div>
        {showImage && (
          <HeadlineLink
            item={item}
            ctx={ctx}
            className={clsx(styles.thumb, imageLoaded && styles.thumbLoaded)}
            tabIndex={-1}
            ariaHidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              ref={imageStateRef(() => setImageFailed(true), () => setImageLoaded(true))}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageFailed(true)}
            />
          </HeadlineLink>
        )}
      </div>
      <Meta item={item} ctx={ctx} isNew={isNew} title={title} />
    </article>
  );
}

export function ReleaseGroupRow({ group, ctx }: { group: ReleaseGroup; ctx: RowContext }) {
  const [open, setOpen] = useState(false);
  const { copy } = ctx;
  const newest = group.items[0];
  const oldest = group.items[group.items.length - 1];
  const newCount = group.items.filter((item) => isNewItem(item, ctx.baseline)).length;
  const allSeen = group.items.every((item) => ctx.seen.has(item.id));
  const name = repoDisplayName(group.repo);
  const countLabel = newCount > 0 ? copy.releasesNew(newCount) : copy.releasesAll(group.items.length);
  const listId = `versions-${group.repo.replace(/[^a-z0-9]+/gi, "-")}`;

  return (
    <article className={clsx(styles.row, allSeen && styles.seen)}>
      <div className={styles.rowBody}>
        <h2 className={styles.rowTitle}>
          <HeadlineLink
            item={newest}
            ctx={ctx}
            className={styles.titleLink}
            seenIds={group.items.map((item) => item.id)}
          >
            {name} · {countLabel}
          </HeadlineLink>{" "}
          <span className={styles.versionRange}>
            {releaseVersion(oldest)} → {releaseVersion(newest)}
          </span>
        </h2>
        <Summary item={newest} ctx={ctx} />
        <Meta
          item={newest}
          ctx={ctx}
          isNew={newCount > 0}
          title={`${name} ${releaseVersion(newest)}`}
          label={copy.topicShort["github-release"]}
        />
        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? copy.hideVersions : copy.showVersions(group.items.length)}
          <ChevronIcon className={clsx(styles.disclosureIcon, open && styles.disclosureIconOpen)} />
        </button>
        {open && (
          <ol id={listId} className={styles.versions}>
            {group.items.map((item) => (
              <li key={item.id} className={clsx(ctx.seen.has(item.id) && styles.seen)}>
                <HeadlineLink item={item} ctx={ctx} className={styles.versionLink}>
                  {releaseVersion(item)}
                </HeadlineLink>
                <span className={styles.versionTime}>
                  {isNewItem(item, ctx.baseline) && (
                    <span className={styles.newDot} aria-label={copy.newBadge} role="img" />
                  )}
                  {timeAgo(ctx.now, new Date(item.publishedAt).getTime(), copy)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}

const INDUSTRY_PREVIEW = 5;

export function IndustryPanel({
  items,
  ctx,
  id,
  className,
}: {
  items: FeedItem[];
  ctx: RowContext;
  id: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const { copy } = ctx;
  const visible = expanded ? items : items.slice(0, INDUSTRY_PREVIEW);
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      className={clsx(styles.industry, className)}
      aria-labelledby={headingId}
      tabIndex={-1}
      data-industry-panel
    >
      <h2 id={headingId} className={styles.industryTitle}>
        {copy.industry}
      </h2>
      <ul className={styles.industryList}>
        {visible.map((item) => {
          const isNew = isNewItem(item, ctx.baseline);
          return (
            <li key={item.id} className={clsx(styles.industryItem, ctx.seen.has(item.id) && styles.seen)}>
              <HeadlineLink item={item} ctx={ctx} className={styles.industryLink}>
                {localizedTitle(item, ctx.language)}
              </HeadlineLink>
              <span className={styles.industryMeta}>
                {isNew && <span className={styles.newDot} aria-label={copy.newBadge} role="img" />}
                {item.coverageCount && item.coverageCount > 1 ? `${copy.sourcesCount(item.coverageCount)} · ` : ""}
                {item.source} · {timeAgo(ctx.now, new Date(item.publishedAt).getTime(), copy)}
              </span>
            </li>
          );
        })}
      </ul>
      {items.length > INDUSTRY_PREVIEW && (
        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? copy.industryLess : copy.industryMore(items.length - INDUSTRY_PREVIEW)}
          <ChevronIcon className={clsx(styles.disclosureIcon, expanded && styles.disclosureIconOpen)} />
        </button>
      )}
    </section>
  );
}
