# news-feed

Personal Facebook-style feed aggregating dev/AI blogs (RSS), Hacker News, and GitHub activity.

## Run

```
npm run dev
```

Then open http://localhost:3000.

## Customize sources

Edit `src/lib/config.ts`:
- `RSS_FEEDS` — add/remove blogs (any RSS/Atom URL)
- `WATCHED_REPOS` — GitHub repos to show new releases for
- `CACHE_TTL_MS` — how often data refreshes (default 10 min)

Optional: set `GITHUB_TOKEN` in `.env.local` to raise the GitHub API rate limit if you watch many repos.
