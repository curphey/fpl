# FPL Insights

Fantasy Premier League analytics dashboard built with Next.js, hosted on Netlify with Supabase authentication.

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (for auth and profile storage)
- A [Netlify](https://netlify.com) account (for hosting)
- Google OAuth credentials configured in your Supabase project

## Local Development

```bash
# Install dependencies
npm install

# Copy environment template and fill in values
cp .env.example .env.local

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable                         | Description                     |
| -------------------------------- | ------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`       | Supabase project URL            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Supabase anonymous (public) key |

## Supabase Setup

1. Create a new Supabase project
2. Run the migration in `supabase/migrations/00001_create_profiles.sql` via the SQL Editor
3. Enable **Google** as an auth provider under Authentication → Providers
4. Set the redirect URI to `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback` for local dev)

## Netlify Deployment

The project includes a `netlify.toml` that configures the Next.js build and the `@netlify/plugin-nextjs` plugin.

1. Connect your GitHub repo to Netlify
2. Set environment variables in Netlify's site settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## GitHub Actions CI/CD

The `.github/workflows/deploy.yml` workflow auto-deploys on push to `main`. Add these secrets to your GitHub repository:

| Secret                           | Description                      |
| -------------------------------- | -------------------------------- |
| `NETLIFY_AUTH_TOKEN`             | Netlify personal access token    |
| `NETLIFY_SITE_ID`               | Netlify site ID                  |
| `NEXT_PUBLIC_SUPABASE_URL`       | Supabase project URL             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Supabase anonymous (public) key  |

## Available Scripts

- `npm run dev` — start dev server
- `npm run build` — production build (validates TypeScript)
- `npm run lint` — run ESLint
- `npm start` — serve production build
