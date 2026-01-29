# FPL Insights

Fantasy Premier League analytics dashboard built with Next.js.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS v4 (PostCSS plugin, `@theme inline` for custom tokens)
- **React:** 19
- **Auth:** Supabase Google OAuth (optional — pages remain public)
- **Database:** Supabase PostgreSQL (`profiles` table for cross-device manager ID sync, `notification_preferences` and `notification_history` for notifications)
- **Hosting:** Netlify (via `@netlify/plugin-nextjs`)
- **CI/CD:** GitHub Actions (auto-deploy on push to `main`)
- **Testing:** Vitest with 159+ tests
- **AI:** Claude API (Sonnet for news search, extended thinking for optimization)
- **PWA:** Service worker, offline support, push notifications
- **Linting:** ESLint 9 + Prettier + lint-staged + Husky

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build (also validates TypeScript)
- `npm run lint` — run ESLint
- `npm test` — run tests (Vitest)
- `npm run test:watch` — run tests in watch mode
- `npm run test:coverage` — run tests with coverage report
- `npm start` — serve production build

## Project Structure

```
app/                    # Next.js App Router pages and API routes
  api/
    fpl/                # Proxy routes to fantasy.premierleague.com/api
      bootstrap-static/ # Bootstrap static data (players, teams, gameweeks)
      fixtures/         # Fixtures data
      element-summary/[id]/ # Player summary and history
      event/[gw]/live/  # Live gameweek data
      entry/[id]/       # Manager entry data
      entry/[id]/history/ # Manager season history
      entry/[id]/event/[gw]/picks/ # Manager picks for gameweek
      leagues-classic/[id]/standings/ # League standings
    optimize/           # Claude AI optimization endpoint
    news/               # Claude-powered FPL news search
      injuries/         # Injury updates endpoint
      team/[team]/      # Team news endpoint
    notifications/send/ # Push notification sending endpoint
  auth/callback/        # Supabase OAuth callback route
  news/page.tsx         # News feed with search and filters
  offline/page.tsx      # Offline fallback page (PWA)
  globals.css           # Tailwind + CSS custom properties (dark theme)
  layout.tsx            # Root layout with AppShell
  page.tsx              # Dashboard (home page)
  fixtures/page.tsx     # Fixture Planner (FDR grid, fixture swings)
  transfers/page.tsx    # Transfer Hub (recommendations, price changes, injury returns)
  captain/page.tsx      # Captain Selector (ranked picks with score breakdown)
  live/page.tsx         # Live Gameweek Tracker (scores, BPS, top performers)
  players/page.tsx      # Players (predictions, set-piece takers)
  chips/page.tsx        # Chip Strategy Advisor (timing recommendations, performance history)
  leagues/page.tsx      # Mini-Leagues (league list)
  leagues/analyze/page.tsx # Mini-League Analyzer (rival picks, EO, differentials, chip tracking)
  team/page.tsx         # My Team (pitch view, squad value tracker)
  optimize/page.tsx     # AI Optimizer (Claude extended thinking)
  notifications/page.tsx # Notification preferences and history
components/
  ui/                   # Reusable primitives (Card, Badge, DataTable, StatCard, Skeleton variants, ErrorState)
  layout/               # App shell, header, sidebar, mobile nav, nav-items, nav-icon, auth-button, manager-input
  dashboard/            # Dashboard sections (gameweek banner, stats, top players, fixtures, progress)
  fixtures/             # Fixture planner grid, best teams ranking, fixture swing alerts
  transfers/            # Transfer table, price changes table, price alerts, timing advice, injury returns
  captain/              # Captain pick cards with detailed score breakdown
  live/                 # Match scores, top performers, BPS tracker
  players/              # Set-piece takers section
  chips/                # Chip timing grid, chip performance history
  leagues/              # Connect prompt, league list, league standings table
  league-analyzer/      # Analyzer tabs, rival picks section, differentials, swing scenarios
  team/                 # Team header, pitch view, gameweek summary/nav, squad value tracker
  optimize/             # Optimize form, thinking display, recommendations display
  notifications/        # Notification preferences form, notification history list
  news/                 # News feed, injury tracker components
  pwa/                  # Service worker registration, pull-to-refresh
lib/fpl/
  types.ts              # TypeScript interfaces for FPL API (691 lines)
  client.ts             # Server-side FPL API client with caching
  hooks/
    use-fpl.ts          # Client-side React hooks (useBootstrapStatic, useFixtures, useLiveGameweek, etc.)
    use-rival-picks.ts  # Batch fetching hook for rival picks with AbortController
    use-rival-histories.ts # Hook for fetching rival manager histories
  utils.ts              # Pure utility functions (sorting, filtering, enrichment, formatting)
  fixture-planner.ts    # Fixture grid builder, FDR calculations, DGW/BGW detection
  fixture-swing.ts      # Fixture swing detection (improving/worsening runs)
  transfer-model.ts     # Transfer recommendation scoring model
  captain-model.ts      # Captain scoring model (form, fixtures, xGI, set pieces)
  price-model.ts        # Price change prediction model with timing advice
  injury-tracker.ts     # Injury returns tracking and watchlist
  points-model.ts       # Player points prediction model
  set-piece-tracker.ts  # Set-piece taker tracking (penalties, corners, free kicks)
  chip-model.ts         # Chip strategy recommendation model
  chip-history.ts       # Chip performance history analysis with verdicts
  rules-engine.ts       # FPL rules (squad composition, formations, chips)
  squad-value.ts        # Squad value calculation and tracking
  league-analyzer.ts    # Mini-league analyzer (rival picks, EO, differentials, chip tracking)
  manager-context.tsx   # Manager ID context with Supabase sync
  index.ts              # Barrel exports
lib/claude/
  types.ts              # Optimization request/response types
  client.ts             # Claude API client with extended thinking
  prompts.ts            # Prompt builders for transfer optimization
  news-types.ts         # News item, category, injury update types
  news-client.ts        # Claude web search for FPL news (searchFPLNews, getInjuryUpdates, getTeamNews)
  hooks.ts              # React hooks for news (useNews, useInjuryUpdates, useTeamNews)
lib/notifications/
  types.ts              # Notification preference and history types
  hooks.ts              # useNotificationPreferences, useNotificationHistory, usePushNotificationStatus, subscribeToPushNotifications
lib/supabase/
  types.ts              # Profile interface matching the profiles table
  client.ts             # Browser-side Supabase client
  server.ts             # Server-side Supabase client (createServerClient with cookies)
middleware.ts           # Refreshes Supabase auth session on every request
supabase/
  migrations/           # SQL migrations (profiles, notification_preferences, notification_history)
public/
  manifest.json         # PWA manifest
  sw.js                 # Service worker (caching, push notifications)
  icons/                # PWA icons (192, 512, apple-touch-icon, favicons)
scripts/
  generate-icons.mjs    # Generate PWA icons from SVG using Sharp
.github/
  workflows/deploy.yml  # GitHub Actions CI/CD pipeline (lint → test → build → deploy)
netlify.toml            # Netlify build config and Next.js plugin
vitest.config.ts        # Vitest configuration
next.config.ts          # Next.js config (image optimization, PWA headers)
```

## Conventions

- **Imports:** Use `@/` path alias (maps to project root)
- **Components:** Named exports, one component per file, PascalCase filenames for components
- **Styling:** Tailwind utility classes; custom colors via CSS variables (`--fpl-purple`, `--fpl-green`, etc.)
- **Theme:** Dark-only (no light/dark toggle); PL brand palette
- **Data fetching:** Client-side hooks in `lib/fpl/hooks/`; API routes proxy to FPL API with caching
- **No external UI libraries:** All components built from scratch with Tailwind
- **Auth is optional:** All pages remain public. Signed-in users get cross-device manager ID persistence via Supabase.
- **Supabase clients:** Use `@/lib/supabase/client` in client components, `@/lib/supabase/server` in server components/route handlers
- **Environment variables:** Supabase vars use `NEXT_PUBLIC_` prefix (needed client-side). `ANTHROPIC_API_KEY` for Claude AI. Never commit `.env*` files.
- **Testing:** Unit tests in `__tests__/` directories adjacent to source files. Use Vitest with mock factories.
- **Pre-commit hooks:** lint-staged runs ESLint and Prettier on staged files, then runs tests.
