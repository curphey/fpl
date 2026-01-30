# Changelog

All notable changes to FPL Insights will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Expected Points Leaderboard page for ranking players by predicted points

## [0.1.0] - 2025-01-30

### Added

#### Core Features

- Dashboard with gameweek overview, top performers, and upcoming fixtures
- My Team page with pitch formation layout and live points tracking
- Fixture Planner with FDR grid and fixture swing alerts
- Transfer Hub with recommendations, price changes, and injury returns
- Captain Selector with ranked picks and score breakdown
- Live Gameweek Tracker with scores, BPS, and top performers
- Players page with predictions and set-piece taker tracking
- Chip Strategy Advisor with timing recommendations and performance history
- Mini-Leagues page with league standings
- Mini-League Analyzer with rival picks, effective ownership, differentials, and chip tracking

#### AI Features

- Claude AI-powered transfer optimization with extended thinking
- FPL news search powered by Claude web search
- Team and injury news endpoints

#### Notifications

- Push notification system with service worker
- Email notifications via Resend
- Scheduled functions for deadline reminders, weekly summaries, and league updates
- Notification preferences and history management

#### PWA

- Service worker with offline support
- Pull-to-refresh on dashboard and live pages
- Installable as Progressive Web App
- Offline fallback page

#### Infrastructure

- Supabase PostgreSQL for user profiles and notification preferences
- Google OAuth authentication (optional)
- Netlify hosting with `@netlify/plugin-nextjs`
- GitHub Actions CI/CD pipeline
- MCP server for Claude Code FPL data access

#### Developer Experience

- TypeScript strict mode throughout
- Vitest testing infrastructure with 150+ tests
- ESLint 9 + Prettier + Husky pre-commit hooks
- Comprehensive type definitions for FPL API (691 lines)

### Technical Details

#### Data Models

- Transfer recommendation scoring model
- Captain scoring model with form, fixtures, xGI, and set pieces
- Price change prediction model with timing advice
- Player points prediction model
- Chip strategy recommendation model

#### API Proxy

- Bootstrap static data (players, teams, gameweeks)
- Fixtures data
- Player summary and history
- Live gameweek data
- Manager entry and history
- Manager picks per gameweek
- League standings

### Security

- Timing-safe string comparison for API key validation
- LRU cache implementation for API responses

[Unreleased]: https://github.com/curphey/fpl/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/curphey/fpl/releases/tag/v0.1.0
