# FPL Insights Deployment Guide

Production deployment guide for FPL Insights using Docker.

**For initial installation and setup, see [INSTALL.md](../INSTALL.md).**

---

## Table of Contents

1. [Docker Deployment](#1-docker-deployment)
2. [Environment Variables](#2-environment-variables)
3. [GitHub Actions CI/CD](#3-github-actions-cicd)
4. [Optional Services](#4-optional-services)
5. [Data Persistence](#5-data-persistence)
6. [Verification](#6-verification)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Docker Deployment

### 1.1 Using Docker Compose (Recommended)

Docker Compose handles all configuration automatically:

```bash
# Start the application
docker compose up -d

# View logs
docker compose logs -f

# Stop the application
docker compose down
```

The `docker-compose.yml` file includes:

- Port mapping (3000:3000)
- Volume mounting for SQLite persistence (`./data:/app/data`)
- Environment variable loading from `.env` file

### 1.2 Using Docker Directly

For more control, use Docker commands directly:

```bash
# Build the image
docker build -t fpl-insights .

# Run the container
docker run -d \
  --name fpl-insights \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  -e ANTHROPIC_API_KEY=your-key-here \
  fpl-insights
```

### 1.3 Development with Docker

For development with hot reload:

```bash
# Using docker-compose.dev.yml
docker compose -f docker-compose.dev.yml up

# Or build and run the dev Dockerfile
docker build -f Dockerfile.dev -t fpl-insights:dev .
docker run -p 3000:3000 -v "$(pwd):/app" fpl-insights:dev
```

### 1.4 Production Build

The production Dockerfile uses a multi-stage build for optimal image size:

1. **Stage 1 (deps)**: Installs production dependencies
2. **Stage 2 (builder)**: Builds the Next.js application
3. **Stage 3 (runner)**: Minimal runtime image with standalone output

```bash
# Build production image
npm run docker:build
# or
docker build -t fpl-insights .

# Run production container
npm run docker:run
# or
docker run -d -p 3000:3000 -v "$(pwd)/data:/app/data" fpl-insights
```

---

## 2. Environment Variables

### 2.1 Configuration

Create a `.env` file in the project root (or copy from `.env.example`):

```bash
cp .env.example .env
```

### 2.2 Available Variables

| Variable                       | Required | Default                 | Description                         |
| ------------------------------ | -------- | ----------------------- | ----------------------------------- |
| `ANTHROPIC_API_KEY`            | No\*     | -                       | Required for AI features            |
| `DATABASE_PATH`                | No       | `./data/fpl.db`         | SQLite database file path           |
| `NEXT_PUBLIC_APP_URL`          | No       | `http://localhost:3000` | Base URL for the app                |
| `NOTIFICATIONS_API_KEY`        | No       | -                       | API key for scheduled notifications |
| `RESEND_API_KEY`               | No       | -                       | For email notifications             |
| `FROM_EMAIL`                   | No       | -                       | Sender email address                |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No       | -                       | For push notifications              |
| `VAPID_PRIVATE_KEY`            | No       | -                       | For push notifications              |
| `VAPID_SUBJECT`                | No       | -                       | Contact email for push (mailto:)    |

\*The app works without any environment variables for basic functionality. AI features require an Anthropic API key.

### 2.3 Example .env File

```env
# Required for AI features (optimizer, simulator, news search)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Optional: Database location (defaults to ./data/fpl.db)
DATABASE_PATH=/app/data/fpl.db

# Optional: App URL (for email links)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Optional: Push notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLxxxxxx
VAPID_PRIVATE_KEY=xxxxxx
VAPID_SUBJECT=mailto:admin@yourdomain.com

# Optional: Email notifications
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL=FPL Insights <noreply@yourdomain.com>

# Optional: Scheduled notification authentication
NOTIFICATIONS_API_KEY=your-random-secure-key
```

---

## 3. GitHub Actions CI/CD

The project includes a GitHub Actions workflow that automatically builds and pushes Docker images to GitHub Container Registry (GHCR) on every push to `main`.

### 3.1 Workflow Overview

The CI/CD pipeline (`.github/workflows/ci.yml`) runs:

1. **Lint** - ESLint checks
2. **Test** - Vitest unit tests
3. **Build** - Docker image build
4. **Push** - Push to GHCR (on main branch)

### 3.2 Setup GHCR

1. Enable GitHub Container Registry for your repository
2. The workflow uses `GITHUB_TOKEN` automatically for authentication
3. Images are pushed to `ghcr.io/curphey/fpl`

### 3.3 Pull and Run from GHCR

```bash
# Pull the latest image
docker pull ghcr.io/curphey/fpl:latest

# Run the container
docker run -d \
  --name fpl-insights \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/curphey/fpl:latest
```

### 3.4 Required Repository Secrets

For full CI/CD functionality, add these secrets in GitHub (Settings > Secrets and variables > Actions):

| Secret        | Description               | Required |
| ------------- | ------------------------- | -------- |
| None required | GITHUB_TOKEN is automatic | -        |

Optional secrets for enhanced CI:

| Secret              | Description                    |
| ------------------- | ------------------------------ |
| `ANTHROPIC_API_KEY` | For running AI-dependent tests |

---

## 4. Optional Services

### 4.1 Anthropic API (AI Features)

Required for: AI Optimizer, Decision Simulator, Rival Analyzer, News Search

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Go to **API Keys**
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-`)

Set in your `.env` file:

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

### 4.2 Resend (Email Notifications)

Required for: Email deadline reminders, weekly summaries

1. Go to [resend.com](https://resend.com/)
2. Sign up or log in
3. Go to **API Keys** and create a new key
4. For production, verify your domain under **Domains**

Set in your `.env` file:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL=FPL Insights <noreply@yourdomain.com>
```

### 4.3 VAPID Keys (Push Notifications)

Generate VAPID keys for web push notifications:

```bash
npx web-push generate-vapid-keys
```

Set in your `.env` file:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLxxxx
VAPID_PRIVATE_KEY=xxxxxx
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

---

## 5. Data Persistence

### 5.1 SQLite Database

FPL Insights uses SQLite for data storage. The database is stored at `./data/fpl.db` by default.

**Schema is auto-created** on first run. No migrations needed.

### 5.2 Docker Volume

The `docker-compose.yml` mounts the data directory:

```yaml
volumes:
  - ./data:/app/data
```

This ensures your data persists between container restarts and updates.

### 5.3 Backup and Restore

**Backup:**

```bash
cp data/fpl.db data/fpl.db.backup
```

**Restore:**

```bash
cp data/fpl.db.backup data/fpl.db
docker restart fpl-insights
```

**Reset database:**

```bash
rm data/fpl.db
docker restart fpl-insights
```

### 5.4 Database Contents

The SQLite database stores:

| Table                      | Description                          |
| -------------------------- | ------------------------------------ |
| `sessions`                 | Browser sessions with FPL manager ID |
| `notification_preferences` | User notification settings           |
| `notification_history`     | Sent notification records            |
| `manager_cache`            | Cached FPL API responses             |

### 5.5 View Database Contents

```bash
# List tables
sqlite3 data/fpl.db ".tables"

# View sessions
sqlite3 data/fpl.db "SELECT * FROM sessions;"

# View schema
sqlite3 data/fpl.db ".schema"
```

---

## 6. Verification

### 6.1 Deployment Checklist

After deployment, verify each feature:

- [ ] **Homepage loads** - Visit http://localhost:3000
- [ ] **FPL data loads** - Check that player data appears on dashboard
- [ ] **Manager ID saves** - Enter a manager ID and verify it persists after refresh
- [ ] **AI Optimizer works** (if Anthropic configured) - Test transfer optimization
- [ ] **Database exists** - Check `data/fpl.db` file is created

### 6.2 Test API Endpoints

```bash
# Test bootstrap data
curl http://localhost:3000/api/fpl/bootstrap-static | head

# Test fixtures
curl http://localhost:3000/api/fpl/fixtures | head

# Test health (returns player count)
curl http://localhost:3000/api/fpl/bootstrap-static | jq '.elements | length'
```

### 6.3 Monitor Logs

```bash
# Docker Compose
docker compose logs -f

# Docker directly
docker logs -f fpl-insights

# Last 100 lines
docker logs --tail 100 fpl-insights
```

---

## 7. Troubleshooting

### Build Fails

**Error:** `Module not found`

- Run `npm ci` locally to verify dependencies
- Check that Dockerfile copies all required files

**Error:** `TypeScript errors`

- Run `npm run build` locally first
- Ensure Node.js version matches (20+)

### Container Won't Start

**Check logs:**

```bash
docker logs fpl-insights
```

**Common issues:**

- Port 3000 already in use: Change the port mapping to `-p 3001:3000`
- Missing data directory: Create `mkdir -p data` before running

### Data Not Loading

**FPL API errors:**

- The FPL API may be temporarily down
- Rate limiting may be active - wait and retry

**Empty dashboard:**

- Check browser console for errors
- Verify container is running: `docker ps`

### Database Issues

**Permission denied:**

```bash
chmod 755 data
chmod 644 data/fpl.db
```

**Corrupt database:**

```bash
rm data/fpl.db
docker restart fpl-insights
```

### AI Features Not Working

- Verify `ANTHROPIC_API_KEY` is set in `.env`
- Check the key is valid at [console.anthropic.com](https://console.anthropic.com/)
- View logs for API errors: `docker logs fpl-insights | grep -i anthropic`

---

## Quick Reference

### Commands

| Task                 | Command                                        |
| -------------------- | ---------------------------------------------- |
| Start                | `docker compose up -d`                         |
| Stop                 | `docker compose down`                          |
| View logs            | `docker compose logs -f`                       |
| Rebuild              | `docker compose build && docker compose up -d` |
| Shell into container | `docker exec -it fpl-insights sh`              |
| View database        | `sqlite3 data/fpl.db`                          |

### Useful Links

- **Anthropic Console:** https://console.anthropic.com/
- **Resend Dashboard:** https://resend.com/
- **Docker Documentation:** https://docs.docker.com/
- **GHCR Documentation:** https://docs.github.com/en/packages

### Support

If you encounter issues:

1. Check this guide's [Troubleshooting](#7-troubleshooting) section
2. Review container logs
3. Open an issue on GitHub
