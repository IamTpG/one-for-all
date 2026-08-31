"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TOPICS } from "@/lib/config";
import type { FeedItem } from "@/lib/types";
import {
  ChevronIcon,
  GithubIcon,
  HnIcon,
  OpenIcon,
  PlayIcon,
  ReleaseIcon,
  RssIcon,
  StarIcon,
  UpvoteIcon,
} from "@/lib/icons";
import styles from "./Card.module.css";

const ICONS = {
  rss: RssIcon,
  hn: HnIcon,
  "github-trending": GithubIcon,
  "github-release": ReleaseIcon,
} as const;

function timeAgo(now: number, iso: string): string {
  const seconds = Math.floor((now - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function Card({ item }: { item: FeedItem }) {
  const [videoShown, setVideoShown] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // Starts equal to the item's own timestamp so the first client render
  // matches the server render exactly (both show "just now"); ticks
  // forward after mount.
  const [now, setNow] = useState(() => new Date(item.publishedAt).getTime());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timeout = setTimeout(tick, 0);
    const interval = setInterval(tick, 60000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [lightboxOpen]);

  const Icon = ICONS[item.sourceType];
  const canReadMore = item.sourceType !== "github-trending";

  return (
    <article className={styles.card}>
      <div className={styles.cardBody}>
        <div className={styles.cardHead}>
          <Icon className={styles.sourceIcon} />
          <span className={`${styles.sourceName} mono`}>{item.source.toUpperCase()}</span>
          <div className={styles.dotSep} />
          <span className={`${styles.timestamp} mono`}>{timeAgo(now, item.publishedAt)}</span>
        </div>

        {item.tag && <span className={`${styles.tagBadge} mono`}>{item.tag}</span>}

        {canReadMore ? (
          <Link href={`/article/${encodeURIComponent(item.id)}`} className={`${styles.headline} display`}>
            {item.title}
          </Link>
        ) : (
          // GitHub Trending items have no detail page to link to (no
          // extraction pipeline for them), so the title still opens the
          // repo directly, same as the "Open" link in the meta row.
          <a
            className={`${styles.headline} display`}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.title}
          </a>
        )}

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
          <div className={styles.media}>
            {videoShown ? (
              <div
                className={styles.videoEmbed}
                dangerouslySetInnerHTML={{ __html: item.videoEmbedHtml }}
              />
            ) : (
              <button
                className={styles.playScrim}
                type="button"
                aria-label="Play video"
                onClick={() => setVideoShown(true)}
              >
                {item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className={styles.mediaImg} loading="lazy" />
                )}
                <span className={styles.playBtn}>
                  <PlayIcon className={styles.playIcon} />
                </span>
              </button>
            )}
          </div>
        ) : (
          item.imageUrl && (
            <div className={styles.media}>
              <button
                className={styles.imageButton}
                type="button"
                aria-label="View full image"
                onClick={() => setLightboxOpen(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt="" className={styles.mediaImg} loading="lazy" />
              </button>
            </div>
          )
        )}

        {item.summary && (
          <div className={styles.summaryRow}>
            {item.aiSummary && <span className={`${styles.aiBadge} mono`}>AI Summary</span>}
            <p className={`${styles.summary} ${styles.clamped}`}>{item.summary}</p>
          </div>
        )}

        {canReadMore && (
          <Link href={`/article/${encodeURIComponent(item.id)}`} className={styles.readMore}>
            {item.sourceType === "github-release" ? "Full changelog" : "Read more"}
            <ChevronIcon className={styles.chevronRight} />
          </Link>
        )}

        {(item.points !== undefined || item.sourceType === "hn" || item.sourceType === "github-trending") && (
          <div className={styles.metaRow}>
            {item.sourceType === "hn" && item.points !== undefined && (
              <div className={styles.metaStat}>
                <UpvoteIcon className={styles.metaIcon} />
                <span className="mono">{item.points} points</span>
              </div>
            )}
            {item.sourceType === "github-trending" && item.points !== undefined && (
              <div className={styles.metaStat}>
                <StarIcon className={styles.metaIcon} />
                <span className="mono">{item.points.toLocaleString()}</span>
              </div>
            )}
            <a className={styles.openLink} href={item.url} target="_blank" rel="noopener noreferrer">
              <span className="mono">Open</span>
              <OpenIcon className={styles.openIcon} />
            </a>
          </div>
        )}
      </div>

      {lightboxOpen && item.imageUrl && (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Full-size image"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className={styles.lightboxClose}
            type="button"
            aria-label="Close"
            onClick={() => setLightboxOpen(false)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6 L18 18 M18 6 L6 18" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt=""
            className={styles.lightboxImg}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </article>
  );
}
