"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setWatchedReposAction } from "./actions/settings";
import type { RepoSearchResult } from "./api/repos/search/route";
import styles from "./AppShell.module.css";

export default function WatchedReposEditor({ initialRepos }: { initialRepos: string[] }) {
  const router = useRouter();
  const [repos, setRepos] = useState<string[]>(initialRepos);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RepoSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    // Below the minimum length, the results section isn't rendered at all
    // (see below), so there's nothing to fetch or clear here.
    if (trimmed.length < 2) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/repos/search?q=${encodeURIComponent(trimmed)}`);
        const data: { items: RepoSearchResult[] } = await res.json();
        if (!cancelled) setResults(data.items);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  async function persist(next: string[]) {
    const previous = repos;
    setRepos(next);
    setError(false);

    const result = await setWatchedReposAction(next);
    if (!result.ok) {
      setRepos(previous);
      setError(true);
      return;
    }
    router.refresh();
  }

  function addRepo(fullName: string) {
    if (repos.includes(fullName)) return;
    persist([...repos, fullName]);
  }

  function removeRepo(fullName: string) {
    persist(repos.filter((r) => r !== fullName));
  }

  return (
    <div className={styles.settingsGroup}>
      <div className={`${styles.settingsPanelTitle} mono`}>Watched Repos</div>

      <input
        type="text"
        className={styles.repoSearchInput}
        placeholder="Search GitHub repos…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {query.trim().length >= 2 && (
        <div className={styles.repoResults}>
          {results.length === 0 && !searching && (
            <div className={styles.repoEmptyState}>No results.</div>
          )}
          {results.map((result) => {
            const alreadyWatched = repos.includes(result.fullName);
            return (
              <div key={result.fullName} className={styles.repoRow}>
                <div className={styles.repoRowInfo}>
                  <span className={styles.repoRowName}>
                    {result.fullName}
                    <span className={`${styles.repoRowStars} mono`}>
                      ★ {result.stars.toLocaleString()}
                    </span>
                  </span>
                  {result.description && (
                    <span className={styles.repoRowDesc}>{result.description}</span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.repoAddButton}
                  disabled={alreadyWatched}
                  onClick={() => addRepo(result.fullName)}
                >
                  {alreadyWatched ? "Added" : "Add"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className={styles.settingsError}>Couldn&apos;t save — try again.</p>}

      <div className={styles.repoWatchedList}>
        {repos.length === 0 && (
          <div className={styles.repoEmptyState}>Not watching any repos.</div>
        )}
        {repos.map((repo) => (
          <div key={repo} className={styles.repoRow}>
            <span className={styles.repoRowName}>{repo}</span>
            <button
              type="button"
              className={styles.repoRemoveButton}
              aria-label={`Stop watching ${repo}`}
              onClick={() => removeRepo(repo)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
