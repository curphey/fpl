# FPL Insights - Installation Guide

Get FPL Insights running on your machine. Choose Docker (recommended) or local Node.js.

---

## Option 1: Docker (Recommended)

Docker packages the app with everything it needs — no Node.js, database, or dependency setup required.

### 1. Install Docker Desktop

Download and install from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).

After installation, open Docker Desktop and wait for it to fully start ("Docker Desktop is running" in the menu bar).

### 2. Clone and Start

```bash
git clone https://github.com/yourusername/fpl.git
cd fpl

# Start with Docker Compose
docker compose up -d
```

### 3. Open the App

Go to [http://localhost:3000](http://localhost:3000) and enter your FPL Manager ID.

### 4. Configure AI Features (Optional)

Create a `.env` file in the project root (or copy from `.env.example`):

```bash
cp .env.example .env
```

Add your Anthropic API key for AI-powered features:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Get a key from [console.anthropic.com](https://console.anthropic.com/) → API Keys → Create Key.

Restart the container after adding the key:

```bash
docker compose down && docker compose up -d
```

### Managing Your Container

| Task      | Command                                        |
| --------- | ---------------------------------------------- |
| Start     | `docker compose up -d`                         |
| Stop      | `docker compose down`                          |
| View logs | `docker compose logs -f`                       |
| Rebuild   | `docker compose build && docker compose up -d` |
| Open app  | http://localhost:3000                          |

### Updating

```bash
git pull
docker compose down
docker compose build
docker compose up -d
```

Your data in `./data/` is preserved between updates.

---

## Option 2: Local Development (Without Docker)

### Prerequisites

- Node.js 20+ ([download](https://nodejs.org/))
- npm (comes with Node.js)
- Git

### Setup

```bash
git clone https://github.com/yourusername/fpl.git
cd fpl
npm install

# Optional: copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm start
```

---

## Environment Variables

| Variable                       | Required | Default          | Description                 |
| ------------------------------ | -------- | ---------------- | --------------------------- |
| `ANTHROPIC_API_KEY`            | No\*     | -                | Required for AI features    |
| `DATABASE_PATH`                | No       | `./data/fpl.db`  | SQLite database file path   |
| `NEXT_PUBLIC_APP_URL`          | No       | `localhost:3000` | Base URL for the app        |
| `NOTIFICATIONS_API_KEY`        | No       | -                | Scheduled notification auth |
| `RESEND_API_KEY`               | No       | -                | Email notifications         |
| `FROM_EMAIL`                   | No       | -                | Sender email address        |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No       | -                | Push notifications          |
| `VAPID_PRIVATE_KEY`            | No       | -                | Push notifications          |
| `VAPID_SUBJECT`                | No       | -                | Push contact (mailto:)      |

\*The app works without any environment variables. AI features require an Anthropic API key.

---

## Data Storage

Your data is stored in `./data/fpl.db` (SQLite). Schema is auto-created on first run.

- **Backup:** `cp data/fpl.db data/fpl.db.backup`
- **Restore:** `cp data/fpl.db.backup data/fpl.db` then restart
- **Reset:** Delete `data/fpl.db` and restart

---

## Troubleshooting

| Problem                     | Solution                                                       |
| --------------------------- | -------------------------------------------------------------- |
| Port 3000 in use            | Use a different port: `-p 3001:3000` or change in compose file |
| Docker daemon not running   | Open Docker Desktop and wait for it to start                   |
| Container stops immediately | Check logs: `docker compose logs`                              |
| AI features don't work      | Verify `ANTHROPIC_API_KEY` in `.env` file                      |
| Database permission denied  | `chmod 755 data && chmod 644 data/fpl.db`                      |

---

**For development setup with Claude Code, TDD, and more, see [DEVELOPING.md](./DEVELOPING.md).**

**For production deployment and CI/CD, see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).**
