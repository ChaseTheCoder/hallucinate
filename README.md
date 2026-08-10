# Hallucinate

A social deduction party game: one shared screen for the host, players join and play from their phones.

## Running locally

```bash
npm install
npm run dev
```

Requires a `.env.local` (see `.env.local` for the current variables in use — audio asset base URLs, rate-limit tuning, and optionally `DATABASE_URL_LOCAL` for persistent local testing against Postgres). Without a database configured, the app runs fine on an in-memory store; state just resets on server restart.

## Pages

- `/` — Home
- `/start` — Start a new game and get a join code
- `/join` — Enter name and join a game
- `/host/[code]` — Host view (shared screen)
- `/player/[code]` — Player view (phone)

## Architecture

- **Next.js Pages Router throughout**, including all API routes (`pages/api/**`). Socket.IO (`pages/api/socket.ts`) is the reason: it needs the raw Node HTTP server that Pages Router API routes expose.
- **Socket.IO** for real-time state — host and players each subscribe into role-scoped rooms and receive only the payload they're allowed to see (`server/gameStore.ts`).
- **Persistence**: in-memory by default, with an optional Postgres-backed store (`server/gameStore.ts`) when `DATABASE_URL`/`DATABASE_URL_LOCAL` is set. Deploys to Vercel with a Render-hosted Postgres instance.
- **Game state machine**: `config/phases.ts` maps internal statuses (join/rules/campaign/vote/results/decision/announcement/final) to the player-facing phases (Campaign/Election/Executive/Final).

For a deeper architectural walkthrough (persistence model details, the socket room/admin-assignment conventions, the full status transition map, and non-obvious constraints), see `CLAUDE.md`.

Designed for local development and small-group demo play; not yet built for public/production traffic.
