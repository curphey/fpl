# FPL Insights

Fantasy Premier League analytics dashboard built with Next.js, featuring AI-powered transfer recommendations, real-time news search, and PWA support.

## Features

- **Dashboard** - Gameweek overview, top performers, upcoming fixtures
- **Captain Selector** - AI-scored captain picks based on form, fixtures, and xGI
- **Transfer Hub** - Recommendations, price change predictions, injury returns
- **Fixture Planner** - FDR grid, fixture swings, DGW/BGW detection
- **Live Tracker** - Real-time scores, BPS tracking, top performers
- **Mini-League Analyzer** - Rival picks, effective ownership, differentials
- **Chip Strategy** - Timing recommendations with performance history
- **AI Optimizer** - Claude-powered transfer recommendations with extended thinking
- **News Feed** - Real-time FPL news via Claude web search
- **Push Notifications** - Deadline reminders, price alerts, injury updates
- **PWA Support** - Install as app, offline support, pull-to-refresh

## Prerequisites

- Node.js 20+
- npm 10+
- A [Supabase](https://supabase.com) project (for auth and data persistence)
- (Optional) [Anthropic API key](https://console.anthropic.com) for AI features
- (Optional) VAPID keys for push notifications

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/fpl.git
cd fpl

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your values (see Environment Variables below)

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file with these variables:

| Variable                        | Required | Description                                        |
| ------------------------------- | -------- | -------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Supabase project URL                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Supabase anonymous (public) key                    |
| `ANTHROPIC_API_KEY`             | No       | Anthropic API key for AI optimizer and news search |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`  | No       | VAPID public key for push notifications            |
| `VAPID_PRIVATE_KEY`             | No       | VAPID private key for push notifications           |

### Generating VAPID Keys

For push notifications, generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

## Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. Run migrations via the SQL Editor (Dashboard → SQL Editor):

   ```sql
   -- Run these in order:
   -- supabase/migrations/00001_create_profiles.sql
   -- supabase/migrations/00002_create_notifications.sql
   ```

3. Enable **Google** as an auth provider:
   - Go to Authentication → Providers
   - Enable Google and add your OAuth credentials

4. Configure redirect URIs:
   - Production: `https://your-domain.com/auth/callback`
   - Development: `http://localhost:3000/auth/callback`

## Available Scripts

| Command                 | Description                             |
| ----------------------- | --------------------------------------- |
| `npm run dev`           | Start development server                |
| `npm run build`         | Production build (validates TypeScript) |
| `npm run lint`          | Run ESLint                              |
| `npm test`              | Run tests once                          |
| `npm run test:watch`    | Run tests in watch mode                 |
| `npm run test:coverage` | Run tests with coverage report          |
| `npm start`             | Serve production build                  |

## PWA Icons

To regenerate PWA icons (requires Sharp):

```bash
npm install sharp --save-dev  # If not already installed
node scripts/generate-icons.mjs
```

This generates icons in `public/icons/`:

- `icon-192.png`, `icon-512.png` - PWA icons
- `apple-touch-icon.png` - iOS home screen
- `favicon-16x16.png`, `favicon-32x32.png` - Browser favicons

## Deployment

### Netlify

The project includes `netlify.toml` for automatic configuration.

1. Connect your GitHub repo to Netlify
2. Set environment variables in Netlify's site settings
3. Deploy triggers automatically on push to `main`

### GitHub Actions CI/CD

The `.github/workflows/deploy.yml` workflow runs lint, tests, and deploys on push to `main`.

Required GitHub Secrets:

| Secret                          | Description                   |
| ------------------------------- | ----------------------------- |
| `NETLIFY_AUTH_TOKEN`            | Netlify personal access token |
| `NETLIFY_SITE_ID`               | Netlify site ID               |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key        |
| `ANTHROPIC_API_KEY`             | (Optional) For AI features    |

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS v4
- **Testing:** Vitest with 159+ tests
- **Auth:** Supabase Google OAuth
- **AI:** Claude API (Sonnet for news, Opus for optimization)
- **Hosting:** Netlify

## Project Structure

See [CLAUDE.md](./CLAUDE.md) for detailed project structure and conventions.

## License

MIT
