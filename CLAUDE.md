@AGENTS.md

# one-for-all (OneForAll)

Personal news feed that collects dev/AI news (RSS, Hacker News, GitHub), filters it to AI-assisted development, summarizes/translates it with Groq, and presents it for quick catch-up. Used by the owner and a few developer friends. See `PRODUCT.md`.

## Stack
- Language/runtime: TypeScript 5 (strict), Node TODO (no `engines`/`.nvmrc`)
- Frameworks: Next.js 16.3.3 (App Router), React 19.2, Tailwind CSS 4, CSS modules
- Data: Redis via `ioredis` (items, retention, settings, usage counters); no SQL/ORM
- Package manager: npm
- Other: Groq SDK (summaries/translation), visx/d3 charts, Vercel hosting, Cloudflare cron Worker (`cloudflare/cron-worker`) hitting `/api/cron/tick` every 10 min

## Layout
- `src/app`: routes, server actions, feed UI, `api/`, `dashboard`, `settings`, `owner-login`
- `src/components`: shared components (`charts/`)
- `src/lib`: fetchers, store/Redis, Groq, translation, fetch cycle, owner auth, config (`config.ts`: RSS_FEEDS, WATCHED_REPOS, cache TTL)
- `cloudflare/cron-worker`: separate npm package (Worker that triggers the cron endpoint)
- `design/`, `DESIGN.md`, `PRODUCT.md`: design decisions and product context

## Commands
- Install: `npm install`
- Dev: `npm run dev`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Test (all / single): TODO (no test setup)
- Build: `npm run build`
- Run the full check before proposing a commit: `npm run typecheck && npm run lint && npm run build`

## Conventions
- Import via `@/*` alias (`src/*`).
- Env vars are documented in `.env.example`; keep it current when adding one.
- Owner-only routes (`/settings`, `/dashboard`) are gated by `OWNER_SECRET`; `/api/cron/tick` by `CRON_SECRET`. Both must fail closed when unset.

## Do not
- Do not expose `OWNER_SECRET`, `CRON_SECRET`, or API keys to client code.
- UI changes must follow `DESIGN.md`, `PRODUCT.md`, `design/DECISIONS.md` (use the impeccable skill).
- Do not read or edit `.env*` files except `.env.example`; keep `.env.example` current.
- Do not add dependencies without asking.

## Binding docs
- `PRODUCT.md`, `DESIGN.md`, `design/DECISIONS.md`, `README.md`

## Workflow notes
- Plans from `architect` live in `.claude/plans/` (gitignored).
