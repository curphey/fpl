# FPL Insights Deployment Guide

This guide walks you through deploying FPL Insights from scratch. Follow each section in order.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Supabase Setup](#2-supabase-setup)
3. [Netlify Setup](#3-netlify-setup)
4. [GitHub Repository Setup](#4-github-repository-setup)
5. [Environment Variables](#5-environment-variables)
6. [Optional Services](#6-optional-services)
7. [Database Migrations](#7-database-migrations)
8. [Verification](#8-verification)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

Before starting, ensure you have:

- [ ] A GitHub account with this repository forked/cloned
- [ ] Node.js 20+ installed locally
- [ ] A Supabase account (free tier works)
- [ ] A Netlify account (free tier works)

**Optional for full functionality:**

- [ ] Anthropic API key (for AI features)
- [ ] Resend account (for email notifications)
- [ ] Upstash account (for rate limiting)
- [ ] Web Push VAPID keys (for push notifications)

---

## 2. Supabase Setup

Supabase provides authentication and database storage.

### 2.1 Create a New Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in the details:
   - **Name:** `fpl-insights` (or your preferred name)
   - **Database Password:** Generate a strong password and save it
   - **Region:** Choose the closest to your users (e.g., `eu-west-2` for UK)
4. Click **"Create new project"**
5. Wait 2-3 minutes for the project to provision

```
┌─────────────────────────────────────────────────────────┐
│  Supabase Dashboard                                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │  New Project                                      │  │
│  │                                                   │  │
│  │  Name: [fpl-insights___________________]          │  │
│  │                                                   │  │
│  │  Database Password: [••••••••••••••••••]          │  │
│  │                     [Generate] [Copy]             │  │
│  │                                                   │  │
│  │  Region: [eu-west-2 (London)________▼]            │  │
│  │                                                   │  │
│  │  [Create new project]                             │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Get Your API Keys

1. In your project dashboard, click **"Settings"** (gear icon) in the left sidebar
2. Click **"API"** under Configuration
3. Copy these values (you'll need them later):

| Setting      | Where to Find                             | Environment Variable            |
| ------------ | ----------------------------------------- | ------------------------------- |
| Project URL  | Under "Project URL"                       | `NEXT_PUBLIC_SUPABASE_URL`      |
| anon public  | Under "Project API keys"                  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| service_role | Under "Project API keys" (click "Reveal") | `SUPABASE_SERVICE_ROLE_KEY`     |

```
┌─────────────────────────────────────────────────────────┐
│  Settings > API                                         │
│                                                         │
│  Project URL                                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │ https://xxxxxxxxxxxxx.supabase.co          [Copy] │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Project API keys                                       │
│                                                         │
│  anon public                                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │ eyJhbGciOiJIUzI1NiIsInR5cCI6...            [Copy] │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  service_role (secret)              [Reveal]            │
│  ┌───────────────────────────────────────────────────┐  │
│  │ eyJhbGciOiJIUzI1NiIsInR5cCI6...            [Copy] │  │
│  └───────────────────────────────────────────────────┘  │
│  ⚠️ This key bypasses RLS. Never expose publicly.       │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Configure Google OAuth (Optional)

For Google sign-in support:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Go to **APIs & Services > Credentials**
4. Click **"Create Credentials" > "OAuth client ID"**
5. Select **"Web application"**
6. Add Authorized redirect URIs:
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```
7. Copy the **Client ID** and **Client Secret**

Back in Supabase:

1. Go to **Authentication > Providers**
2. Find **Google** and click to expand
3. Toggle **"Enable Google provider"** ON
4. Paste your Client ID and Client Secret
5. Click **"Save"**

```
┌─────────────────────────────────────────────────────────┐
│  Authentication > Providers > Google                    │
│                                                         │
│  [✓] Enable Google provider                             │
│                                                         │
│  Client ID                                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 123456789-xxxxx.apps.googleusercontent.com        │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Client Secret                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ GOCSPX-xxxxxxxxxxxxxxxxx                          │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  [Save]                                                 │
└─────────────────────────────────────────────────────────┘
```

### 2.4 Configure Site URL

1. Go to **Authentication > URL Configuration**
2. Set **Site URL** to your production domain:
   ```
   https://your-site.netlify.app
   ```
3. Add **Redirect URLs**:
   ```
   https://your-site.netlify.app/auth/callback
   http://localhost:3000/auth/callback
   ```

---

## 3. Netlify Setup

Netlify hosts the application and runs scheduled functions.

### 3.1 Create a New Site

1. Go to [https://app.netlify.com/](https://app.netlify.com/)
2. Click **"Add new site" > "Import an existing project"**
3. Select **GitHub** as your Git provider
4. Authorize Netlify to access your repositories
5. Select the `fpl` repository

```
┌─────────────────────────────────────────────────────────┐
│  Import an existing project                             │
│                                                         │
│  Connect to Git provider                                │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   GitHub    │  │   GitLab    │  │  Bitbucket  │     │
│  │     ✓       │  │             │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Configure Build Settings

Netlify should auto-detect these, but verify:

| Setting             | Value               |
| ------------------- | ------------------- |
| Build command       | `npm run build`     |
| Publish directory   | `.next`             |
| Functions directory | `netlify/functions` |

```
┌─────────────────────────────────────────────────────────┐
│  Build settings                                         │
│                                                         │
│  Build command                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ npm run build                                     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Publish directory                                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │ .next                                             │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Get Netlify Credentials for CI/CD

1. Go to **Site settings > General > Site details**
2. Copy the **Site ID** (under "API ID")

For the auth token:

1. Go to [https://app.netlify.com/user/applications](https://app.netlify.com/user/applications)
2. Click **"New access token"**
3. Give it a name like `github-actions`
4. Copy the token (you won't see it again!)

| Setting    | Where to Find                | GitHub Secret Name   |
| ---------- | ---------------------------- | -------------------- |
| Site ID    | Site settings > General      | `NETLIFY_SITE_ID`    |
| Auth Token | User settings > Applications | `NETLIFY_AUTH_TOKEN` |

---

## 4. GitHub Repository Setup

### 4.1 Add Repository Secrets

1. Go to your GitHub repository
2. Click **Settings > Secrets and variables > Actions**
3. Click **"New repository secret"** for each:

**Required Secrets:**

| Secret Name                     | Value                     | Description                |
| ------------------------------- | ------------------------- | -------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://xxx.supabase.co` | From Supabase API settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...`             | From Supabase API settings |
| `NETLIFY_SITE_ID`               | `xxxxxxxx-xxxx-xxxx-xxxx` | From Netlify site settings |
| `NETLIFY_AUTH_TOKEN`            | `nfp_xxxxx`               | From Netlify user settings |

```
┌─────────────────────────────────────────────────────────┐
│  Settings > Secrets and variables > Actions             │
│                                                         │
│  Repository secrets                                     │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │ NETLIFY_AUTH_TOKEN              Updated 2 days ago ││
│  │ NETLIFY_SITE_ID                 Updated 2 days ago ││
│  │ NEXT_PUBLIC_SUPABASE_ANON_KEY   Updated 2 days ago ││
│  │ NEXT_PUBLIC_SUPABASE_URL        Updated 2 days ago ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  [New repository secret]                                │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Verify CI/CD Pipeline

Push a commit to `main` branch. The GitHub Actions workflow will:

1. Install dependencies
2. Run linting
3. Run unit tests
4. Run E2E tests
5. Build the application
6. Deploy to Netlify

Check progress at: `https://github.com/YOUR_USERNAME/fpl/actions`

---

## 5. Environment Variables

### 5.1 Netlify Environment Variables

1. Go to **Site settings > Environment variables**
2. Add each variable:

**Core Variables (Required):**

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=https://your-site.netlify.app
```

**Authentication (Required for user features):**

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**AI Features (Optional but recommended):**

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

**Notifications (Optional):**

```env
NOTIFICATIONS_API_KEY=your-random-secure-key-here
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL=FPL Insights <noreply@yourdomain.com>
```

**Push Notifications (Optional):**

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLxxxxxx
VAPID_PRIVATE_KEY=xxxxxx
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

**Rate Limiting (Optional):**

```env
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxx
```

```
┌─────────────────────────────────────────────────────────┐
│  Site settings > Environment variables                  │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Key                              Value              ││
│  │ ─────────────────────────────────────────────────── ││
│  │ NEXT_PUBLIC_SUPABASE_URL        https://xxx.sup... ││
│  │ NEXT_PUBLIC_SUPABASE_ANON_KEY   eyJhbGciOiJIUz...   ││
│  │ NEXT_PUBLIC_APP_URL             https://your-si... ││
│  │ ANTHROPIC_API_KEY               sk-ant-api03-...   ││
│  │ ...                                                 ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  [Add a variable]                                       │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Local Development

Create a `.env.local` file in your project root:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your values. **Never commit this file.**

---

## 6. Optional Services

### 6.1 Anthropic API (AI Features)

Required for: AI Optimizer, Decision Simulator, Rival Analyzer, News Search

1. Go to [https://console.anthropic.com/](https://console.anthropic.com/)
2. Sign up or log in
3. Go to **API Keys**
4. Click **"Create Key"**
5. Copy the key (starts with `sk-ant-`)

```
┌─────────────────────────────────────────────────────────┐
│  Anthropic Console > API Keys                           │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Name          Key                    Created        ││
│  │ ───────────────────────────────────────────────────-││
│  │ Production    sk-ant-api03-...       Jan 15, 2025   ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  [Create Key]                                           │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Resend (Email Notifications)

Required for: Email deadline reminders, weekly summaries

1. Go to [https://resend.com/](https://resend.com/)
2. Sign up or log in
3. Go to **API Keys**
4. Click **"Create API Key"**
5. Copy the key (starts with `re_`)

**Domain Setup (for production):**

1. Go to **Domains**
2. Click **"Add Domain"**
3. Add your domain (e.g., `notifications.yourdomain.com`)
4. Add the DNS records shown to your domain registrar
5. Click **"Verify"**

### 6.3 Upstash Redis (Rate Limiting)

Required for: Production rate limiting (falls back to in-memory if not configured)

1. Go to [https://console.upstash.com/](https://console.upstash.com/)
2. Click **"Create Database"**
3. Select **"Regional"** and choose your region
4. Name it `fpl-rate-limit`
5. Copy from the **REST API** section:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 6.4 VAPID Keys (Push Notifications)

Generate VAPID keys for web push notifications:

```bash
npx web-push generate-vapid-keys
```

Output:

```
=======================================

Public Key:
BLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Private Key:
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

=======================================
```

Set these as:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = Public Key
- `VAPID_PRIVATE_KEY` = Private Key

---

## 7. Database Migrations

Run the SQL migrations in Supabase to create required tables.

### 7.1 Run Migrations via SQL Editor

1. Go to your Supabase project dashboard
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"**

**Migration 1: Profiles Table**

Copy and paste this SQL, then click **"Run"**:

```sql
-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  fpl_manager_id bigint,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Index for looking up profiles by FPL manager ID
create index idx_profiles_fpl_manager_id on public.profiles (fpl_manager_id);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- RLS policies: users can only access their own row
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Function to auto-create a profile row on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;

-- Trigger on auth.users insert
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

You should see: **"Success. No rows returned"**

**Migration 2: Notifications Tables**

Create a new query and run:

```sql
-- Create notification_preferences table
create table public.notification_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null unique,

  -- Email preferences
  email_enabled boolean default false not null,
  email_address text,
  email_deadline_reminder boolean default true not null,
  email_deadline_hours integer default 24 not null,
  email_weekly_summary boolean default true not null,
  email_transfer_recommendations boolean default true not null,

  -- Push notification preferences
  push_enabled boolean default false not null,
  push_subscription jsonb,
  push_deadline_reminder boolean default true not null,
  push_deadline_hours integer default 1 not null,
  push_price_changes boolean default true not null,
  push_injury_news boolean default true not null,
  push_league_updates boolean default true not null,

  -- General settings
  quiet_hours_start integer,
  quiet_hours_end integer,
  timezone text default 'Europe/London' not null,

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Index for looking up preferences by user
create index idx_notification_preferences_user_id on public.notification_preferences (user_id);

-- Enable Row Level Security
alter table public.notification_preferences enable row level security;

-- RLS policies
create policy "Users can view own notification preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own notification preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notification preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id);

-- Create notification_history table
create table public.notification_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  notification_type text not null,
  channel text not null,
  title text not null,
  body text not null,
  data jsonb,
  sent_at timestamptz default now() not null,
  read_at timestamptz,
  clicked_at timestamptz
);

-- Index for querying user's notification history
create index idx_notification_history_user_id on public.notification_history (user_id, sent_at desc);

-- Enable Row Level Security
alter table public.notification_history enable row level security;

-- RLS policies for notification history
create policy "Users can view own notification history"
  on public.notification_history for select
  using (auth.uid() = user_id);

create policy "Users can update own notification history"
  on public.notification_history for update
  using (auth.uid() = user_id);

-- Function to auto-create notification preferences on user signup
create or replace function public.handle_new_user_notifications()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.notification_preferences (user_id, email_address)
  values (new.id, new.email);
  return new;
end;
$$;

-- Trigger on auth.users insert
create trigger on_auth_user_created_notifications
  after insert on auth.users
  for each row execute function public.handle_new_user_notifications();

-- Function to update updated_at timestamp
create or replace function public.update_notification_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger to auto-update updated_at
create trigger update_notification_preferences_timestamp
  before update on public.notification_preferences
  for each row execute function public.update_notification_preferences_updated_at();
```

### 7.2 Verify Tables

1. Go to **Table Editor** in the left sidebar
2. You should see three tables:
   - `profiles`
   - `notification_preferences`
   - `notification_history`

```
┌─────────────────────────────────────────────────────────┐
│  Table Editor                                           │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 📋 profiles                              3 columns  ││
│  │ 📋 notification_preferences             18 columns  ││
│  │ 📋 notification_history                  9 columns  ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## 8. Verification

### 8.1 Deployment Checklist

After deployment, verify each feature:

- [ ] **Homepage loads** - Visit your Netlify URL
- [ ] **FPL data loads** - Check that player data appears on dashboard
- [ ] **Google sign-in works** (if configured) - Try signing in
- [ ] **Manager ID saves** - Enter a manager ID and verify it persists
- [ ] **AI Optimizer works** (if Anthropic configured) - Test optimization
- [ ] **Email notifications** (if Resend configured) - Check settings page

### 8.2 Test API Endpoints

```bash
# Test bootstrap data
curl https://your-site.netlify.app/api/fpl/bootstrap-static | head

# Test with enrichment
curl "https://your-site.netlify.app/api/fpl/bootstrap-static?enrich=true" | head

# Test fixtures
curl https://your-site.netlify.app/api/fpl/fixtures | head
```

### 8.3 Monitor Logs

**Netlify Functions Logs:**

1. Go to **Netlify Dashboard > Functions**
2. Click on a function to view logs
3. Check for errors in scheduled functions

**Supabase Logs:**

1. Go to **Supabase Dashboard > Database > Logs**
2. Check for authentication or RLS errors

---

## 9. Troubleshooting

### Build Fails

**Error:** `Module not found`

- Run `npm ci` locally to verify dependencies
- Check that all environment variables are set

**Error:** `TypeScript errors`

- Run `npm run build` locally first
- Ensure Node.js version matches (20+)

### Authentication Issues

**Google sign-in fails:**

- Verify redirect URLs match in both Google Console and Supabase
- Check that Site URL in Supabase matches your Netlify domain

**401 Unauthorized:**

- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
- Check RLS policies allow the operation

### Data Not Loading

**FPL API errors:**

- The FPL API may be temporarily down (check status)
- Rate limiting may be active - wait and retry

**Empty dashboard:**

- Check browser console for errors
- Verify environment variables are set in Netlify

### Notifications Not Working

**Emails not sending:**

- Verify `RESEND_API_KEY` is set
- Check Resend dashboard for delivery status
- Verify domain is verified (for custom domains)

**Push notifications failing:**

- Verify VAPID keys are correct
- Check browser supports notifications
- Ensure HTTPS is being used

---

## Quick Reference

### All Environment Variables

| Variable                        | Required          | Description             |
| ------------------------------- | ----------------- | ----------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes               | Supabase project URL    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes               | Supabase anon key       |
| `NEXT_PUBLIC_APP_URL`           | Yes               | Your production URL     |
| `SUPABASE_SERVICE_ROLE_KEY`     | For notifications | Supabase service key    |
| `ANTHROPIC_API_KEY`             | For AI features   | Anthropic API key       |
| `NOTIFICATIONS_API_KEY`         | For notifications | Random secure string    |
| `RESEND_API_KEY`                | For email         | Resend API key          |
| `FROM_EMAIL`                    | For email         | Sender email address    |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`  | For push          | VAPID public key        |
| `VAPID_PRIVATE_KEY`             | For push          | VAPID private key       |
| `VAPID_SUBJECT`                 | For push          | Contact email (mailto:) |
| `UPSTASH_REDIS_REST_URL`        | For rate limiting | Upstash REST URL        |
| `UPSTASH_REDIS_REST_TOKEN`      | For rate limiting | Upstash REST token      |

### Useful Links

- **Supabase Dashboard:** https://supabase.com/dashboard
- **Netlify Dashboard:** https://app.netlify.com/
- **Anthropic Console:** https://console.anthropic.com/
- **Resend Dashboard:** https://resend.com/
- **Upstash Console:** https://console.upstash.com/
- **Google Cloud Console:** https://console.cloud.google.com/

### Support

If you encounter issues:

1. Check this guide's [Troubleshooting](#9-troubleshooting) section
2. Review Netlify function logs
3. Check Supabase database logs
4. Open an issue on GitHub: https://github.com/YOUR_USERNAME/fpl/issues
