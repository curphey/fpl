# FPL Insights - Installation Guide

This guide will walk you through setting up FPL Insights using Docker Desktop.

## Prerequisites

### 1. Install Docker Desktop

1. Go to [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
2. Download Docker Desktop for Mac
3. Run the installer and follow the prompts
4. After installation, open Docker Desktop and wait for it to fully start (you'll see "Docker Desktop is running" in the menu bar)

### 2. Install Git (if not already installed)

Open Terminal and run:

```bash
git --version
```

If Git isn't installed, you'll be prompted to install the Xcode Command Line Tools. Follow the prompts.

### 3. Clone FPL Insights

```bash
git clone https://github.com/your-username/fpl-insights.git
cd fpl-insights
```

---

## Setup Using Docker Desktop GUI

### Step 1: Build the Docker Image

1. **Open Terminal** in the `fpl-insights` folder:
   - Open Finder and navigate to your `fpl-insights` folder
   - Right-click the folder → Services → New Terminal at Folder
   - Or open Terminal and type `cd ` then drag the folder into Terminal

2. **Build the image:**

   ```bash
   docker build -t fpl-insights .
   ```

   This will take 2-5 minutes the first time. You'll see lots of text scrolling by - this is normal.

3. **Verify the build in Docker Desktop:**
   - Open Docker Desktop
   - Click on **Images** in the left sidebar
   - You should see `fpl-insights` listed

### Step 2: Run the Container

1. In Docker Desktop, go to **Images**
2. Find `fpl-insights` in the list
3. Hover over it and click the **Run** button (▶️)
4. Click **Optional settings** to expand the options
5. Configure the following:

   | Setting                     | Value                                                                                                                     |
   | --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
   | **Container name**          | `fpl-insights`                                                                                                            |
   | **Host port**               | `3000`                                                                                                                    |
   | **Volumes: Host path**      | Click the folder icon and select a folder called `data` inside your `fpl-insights` folder (create it if it doesn't exist) |
   | **Volumes: Container path** | `/app/data`                                                                                                               |

6. Click **Run**

7. The container will start. Click on `fpl-insights` under **Containers** to see the logs.

### Step 3: Open the App

1. Go to [http://localhost:3000](http://localhost:3000) in your browser
2. Enter your FPL Manager ID in the header (find it on the FPL website in your team URL)

### Step 4: Configure AI Features

1. Go to **Settings** (gear icon in the header)
2. Enter your Anthropic API key
   - Get one from [console.anthropic.com](https://console.anthropic.com/)
   - Sign up or log in
   - Go to API Keys and create a new key
   - Copy the key (starts with `sk-ant-`)
3. Click **Save**

The AI features (transfer suggestions, captain picks, optimization) will now work.

---

## Managing Your Container

### Using Docker Desktop GUI

| Action                    | How to Do It                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| **Stop the app**          | Go to Containers → Click the ⏹️ stop button next to `fpl-insights`                       |
| **Start the app**         | Go to Containers → Click the ▶️ play button next to `fpl-insights`                       |
| **View logs**             | Go to Containers → Click on `fpl-insights` → Logs tab                                    |
| **Delete container**      | Go to Containers → Click the 🗑️ delete button (your data in `data/` folder is preserved) |
| **Rebuild after updates** | Delete the container, go to Images → Delete `fpl-insights` → Rebuild with Step 1         |

---

## Updating FPL Insights

When there's a new version:

1. **Pull the latest code:**

   ```bash
   cd fpl-insights
   git pull
   ```

2. **Stop and remove the old container:**
   - Docker Desktop: Containers → Stop → Delete

3. **Remove the old image:**
   - Docker Desktop: Images → Delete `fpl-insights`

4. **Rebuild and run:**
   - Follow Step 1 and Step 2 again

Your data (manager ID, settings) is stored in the `data/` folder and will be preserved.

---

## Troubleshooting

### "Port 3000 is already in use"

Something else is using port 3000. Either:

- Stop the other application using port 3000
- Use a different port: In Docker Desktop, set Host port to `3001` instead (then access at http://localhost:3001)

### "Cannot connect to the Docker daemon"

Docker Desktop isn't running. Open Docker Desktop and wait for it to fully start.

### Container stops immediately after starting

Check the logs for errors:

- Docker Desktop: Click on the container → Logs tab

### AI features don't work

Make sure you've added your Anthropic API key in Settings. Check your key at [console.anthropic.com](https://console.anthropic.com/).

---

## Data Storage

Your data is stored in the `data/` folder:

- `fpl.db` - SQLite database with your sessions, settings, and preferences

**To backup:** Copy the entire `data/` folder somewhere safe.

**To restore:** Replace the `data/` folder with your backup and restart the container.

**To reset:** Delete the `data/fpl.db` file and restart the container.

---

## Alternative: Command Line Setup

If you prefer using the terminal instead of Docker Desktop GUI:

### Build

```bash
docker build -t fpl-insights .
```

### Run

```bash
docker run -d \
  --name fpl-insights \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  fpl-insights
```

### Manage

```bash
# Stop the container
docker stop fpl-insights

# Start the container again
docker start fpl-insights

# View logs
docker logs fpl-insights

# View logs in real-time
docker logs -f fpl-insights

# Remove the container (keeps your data)
docker rm fpl-insights

# Remove the image (to rebuild)
docker rmi fpl-insights
```

### Using Docker Compose

For an even simpler setup:

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Rebuild after updates
docker compose down
docker compose build
docker compose up -d
```

Then open [http://localhost:3000](http://localhost:3000).

---

## Quick Reference

| Task           | Command / Action                 |
| -------------- | -------------------------------- |
| Build image    | `docker build -t fpl-insights .` |
| Run container  | `docker compose up -d`           |
| Stop container | `docker compose down`            |
| View logs      | `docker logs fpl-insights`       |
| Open app       | http://localhost:3000            |
| Your data      | `./data/fpl.db`                  |
