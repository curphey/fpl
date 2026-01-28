# FPL Insights

Fantasy Premier League analytics dashboard built with Next.js.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS v4 (PostCSS plugin, `@theme inline` for custom tokens)
- **React:** 19
- **Auth:** Supabase Google OAuth (optional — pages remain public)
- **Database:** Supabase PostgreSQL (`profiles` table for cross-device manager ID sync)
- **Hosting:** Netlify (via `@netlify/plugin-nextjs`)
- **CI/CD:** GitHub Actions (auto-deploy on push to `main`)
- **Linting:** ESLint 9 + Prettier

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build (also validates TypeScript)
- `npm run lint` — run ESLint
- `npm start` — serve production build

## Project Structure

```
app/                    # Next.js App Router pages and API routes
  api/fpl/              # Proxy routes to fantasy.premierleague.com/api
  auth/callback/        # Supabase OAuth callback route
  globals.css           # Tailwind + CSS custom properties (dark theme)
  layout.tsx            # Root layout with AppShell
  page.tsx              # Dashboard (home page)
  fixtures/page.tsx     # Fixture Planner (FDR grid)
  transfers/page.tsx    # Transfer Recommender (scored recommendations)
  captain/page.tsx      # Captain Selector (ranked picks)
  live/page.tsx         # Live Gameweek Tracker (scores, BPS, top performers)
  players/page.tsx      # Players placeholder
components/
  ui/                   # Reusable primitives (Card, Badge, DataTable, StatCard, Skeleton, ErrorState)
  layout/               # App shell, header, sidebar, mobile nav, nav config, auth button
  dashboard/            # Dashboard sections (gameweek banner, stats, top players, fixtures, progress)
  fixtures/             # Fixture planner grid, best teams ranking
  transfers/            # Transfer recommendation table
  captain/              # Captain pick cards with score breakdown
  live/                 # Match scores, top performers, BPS tracker
lib/fpl/
  types.ts              # TypeScript interfaces for FPL API
  client.ts             # Server-side FPL API client
  hooks/use-fpl.ts      # Client-side React hooks (useBootstrapStatic, useFixtures, etc.)
  utils.ts              # Pure utility functions (sorting, filtering, enrichment)
  fixture-planner.ts    # Fixture grid builder, FDR calculations, DGW/BGW detection
  transfer-model.ts     # Transfer recommendation scoring model
  captain-model.ts      # Captain scoring model (form, fixtures, xGI, set pieces)
  manager-context.tsx   # Manager ID context with Supabase sync
  index.ts              # Barrel exports
lib/supabase/
  types.ts              # Profile interface matching the profiles table
  client.ts             # Browser-side Supabase client (createBrowserClient)
  server.ts             # Server-side Supabase client (createServerClient with cookies)
middleware.ts           # Refreshes Supabase auth session on every request
supabase/
  migrations/           # SQL migrations for Supabase (profiles table, RLS, triggers)
.github/
  workflows/deploy.yml  # GitHub Actions CI/CD pipeline (lint → build → deploy to Netlify)
netlify.toml            # Netlify build config and Next.js plugin
```

## Conventions

- **Imports:** Use `@/` path alias (maps to project root)
- **Components:** Named exports, one component per file, PascalCase filenames for components
- **Styling:** Tailwind utility classes; custom colors via CSS variables (`--fpl-purple`, `--fpl-green`, etc.)
- **Theme:** Dark-only (no light/dark toggle); PL brand palette
- **Data fetching:** Client-side hooks in `lib/fpl/hooks/use-fpl.ts`; API routes proxy to FPL API with caching
- **No external UI libraries:** All components built from scratch with Tailwind
- **Auth is optional:** All pages remain public. Signed-in users get cross-device manager ID persistence via Supabase.
- **Supabase clients:** Use `@/lib/supabase/client` in client components, `@/lib/supabase/server` in server components/route handlers
- **Environment variables:** Supabase vars use `NEXT_PUBLIC_` prefix (needed client-side). Never commit `.env*` files (covered by `.gitignore`).
