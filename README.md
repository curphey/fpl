# FPL Insights

Fantasy Premier League analytics dashboard with AI-powered recommendations.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tests](https://img.shields.io/badge/Tests-512%2B-green)

## Features

- **Live Gameweek Tracking** - Real-time scores, bonus points prediction, top performers
- **AI Transfer Optimization** - Claude-powered transfer recommendations with extended thinking
- **Fixture Difficulty Analysis** - FDR grid, fixture swings, DGW/BGW detection
- **Captain Selector** - Multi-factor scoring with form, fixtures, xGI, and set pieces
- **Mini-League Analyzer** - Rival tracking, effective ownership, differentials
- **Chip Strategy Advisor** - Optimal timing recommendations for all chips
- **Draft Mode** - Snake/auction draft simulator with ADP rankings and keeper analysis
- **Push Notifications** - Deadline reminders, price changes, injury alerts

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Fill in environment variables (see below)

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Create `.env.local` with:

```bash
# Supabase (required for auth features)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Claude AI (required for optimization features)
ANTHROPIC_API_KEY=your_claude_api_key

# Notifications (optional)
NOTIFICATIONS_API_KEY=your_notifications_key
RESEND_API_KEY=your_resend_key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public
VAPID_PRIVATE_KEY=your_vapid_private

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Commands

| Command                 | Description              |
| ----------------------- | ------------------------ |
| `npm run dev`           | Start development server |
| `npm run build`         | Production build         |
| `npm run lint`          | Run ESLint               |
| `npm test`              | Run tests (Vitest)       |
| `npm run test:watch`    | Run tests in watch mode  |
| `npm run test:coverage` | Run tests with coverage  |

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS v4
- **React:** 19
- **Auth:** Supabase Google OAuth
- **Database:** Supabase PostgreSQL
- **AI:** Claude API (Sonnet for search, extended thinking for optimization)
- **Testing:** Vitest (512+ tests)
- **PWA:** Service worker, offline support, push notifications

## Project Structure

```
app/                    # Next.js App Router pages and API routes
components/             # React components organized by feature
lib/
  fpl/                  # FPL data types, client, hooks, and scoring models
  claude/               # Claude API client and prompt builders
  notifications/        # Push notification and email services
  api/                  # API utilities (validation, rate limiting)
public/                 # PWA manifest, icons, service worker
```

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed project documentation including:

- Complete file-by-file structure
- Coding conventions
- API reference
- Testing patterns

## API Rate Limits

| Endpoint Category      | Limit   |
| ---------------------- | ------- |
| FPL proxy routes       | 100/min |
| Claude AI endpoints    | 10/min  |
| Notification endpoints | 20/min  |

## License

Private - All rights reserved
