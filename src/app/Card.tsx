"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

        <a
          className={`${styles.headline} display`}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.title}
        </a>

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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt="" className={styles.mediaImg} loading="lazy" />
            </div>
          )
        )}

        {item.summary && <p className={`${styles.summary} ${styles.clamped}`}>{item.summary}</p>}

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
    </article>
  );
}
