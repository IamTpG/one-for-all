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

## Scheduled fetching (Cloudflare Cron Trigger)

Fetching and Vietnamese translation are driven by `GET /api/cron/tick`. Vercel's
Hobby plan only allows a daily cron, so a small Cloudflare Worker
(`cloudflare/cron-worker`) calls that endpoint every 10 minutes instead. All the
real work still runs on Vercel; the Worker only wakes it up.

Deploy it once:

```
cd cloudflare/cron-worker
npm install
# set APP_URL in wrangler.jsonc to your Vercel URL (no trailing slash)
npx wrangler login
npx wrangler secret put CRON_SECRET   # same value as CRON_SECRET on Vercel
npx wrangler deploy
```

Local test: `npm run dev` there, then `curl "http://localhost:8787/__scheduled"`
(put `CRON_SECRET` and `APP_URL=http://localhost:3000` in `.dev.vars`).
