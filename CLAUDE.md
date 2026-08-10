# Hallucinate

A social deduction party game (host on a shared screen, players on their phones). Currently a friends-and-family MVP; longer-term plan is a B2C version with host SSO, per-game payment, and no-login phone play (player side already meets that constraint).

## Stack & Architecture

- **Next.js 16, Pages Router only.** There is no App Router code despite what an older draft of README.md may say — if you see `app/api/...` referenced anywhere, that's stale, not real. All routes live under `pages/api/`.
- **Socket.IO lives in `pages/api/socket.ts`** specifically because it needs the raw Node HTTP server, which the Pages Router API exposes and the App Router doesn't. This is the reason the whole backend stayed on Pages Router rather than a reason to avoid it going forward.
- React 19, TypeScript (`strict: false`, but `strictNullChecks: true` — null/undefined are checked, other strict rules aren't).
- No test suite, no linter configured yet. Don't assume `npm test` or `npm run lint` exist.
- Deploy target: **Vercel** (frontend/API routes) + **Render**-hosted Postgres (data). This split is why persistence code branches on environment (see below) — it's not incidental.

## Persistence model

`server/gameStore.ts` is the single source of truth for reading/writing game state.

- Primary store is an **in-memory object** (`games`), keyed by game UUID.
- If `DATABASE_URL` (prod) or `DATABASE_URL_LOCAL` (dev, pointed at Render's external URL) is set, every `persistGame` call also upserts to a `games_state` Postgres table (JSONB payload), and `findGameByCode` falls back to the DB on an in-memory miss.
- If the DB host can't be resolved in development, it silently disables itself for the session and falls back to memory-only — this is intentional for local dev without a DB, but **do not carry this silent-fallback behavior into a paid/production path**; a real host paying for a game must not have their state silently drop on a DB hiccup.
- Game codes are 4-char, generated avoiding ambiguous characters (`makeCode` in `gameStore.ts`).

## Real-time model

Two socket subscription flows, both joining shared rooms so a single `emitRoleBasedGameUpdates(io, game)` call (in `gameStore.ts`) can broadcast to everyone at once:

- **Host**: `subscribe-to-host` → joins `host-game-{code}` and `game-{code}` → receives the full `enrichGame()` payload.
- **Player**: `subscribe-to-player` → joins `player-{code}-{playerName}` and `game-{code}` → receives a per-player `buildPlayerProjection()` payload (only what that player is allowed to see — e.g. vote candidates, whether they can currently act).
- **Admin assignment happens here, not in the join API**: on `subscribe-to-player`, if no player in the game has `isAdmin`, the connecting player becomes admin. There's also a self-healing check that demotes any duplicate admins. If you're debugging "who is admin" bugs, look in `pages/api/socket.ts`, not `join.ts`.
- Disconnect/reconnect toggles `player.isConnected` and broadcasts `player-disconnected` / `player-reconnected` events; vote-completion and start-game checks are gated on `isConnected`, not just presence in the players array.

## Game state machine

`config/phases.ts` maps internal `StatusTypes` → player-facing `PhaseTypes` (the "Rule of Three": Campaign → Election → Executive → Final). **This file is the single source of truth for that mapping** — don't hardcode phase labels elsewhere.

Status flow (driven by `pages/api/game/[code]/update.ts`, `vote.ts`, `decision.ts`):

```
join → rules → campaign → vote → results → decision → announcement → campaign (loop)
                              └─ if only 2 qualified players remain → final (skips results/decision/announcement)
```

Non-obvious rules baked into `update.ts`:
- `join → rules` requires 4+ players and qualifies everyone at once.
- `campaign` auto-transitions to `vote` when `electionCycleStartTime + cycleTime` elapses (server-authoritative timer; clients only display a countdown).
- The final round (2 qualified players left) gets a fixed 5-minute campaign timer regardless of the host-configured `cycleTime`.
- `announcement → campaign` is the round-reset point: clears `hasVoted` for everyone, increments `currentRound`, and deletes `executiveDecision`/`executiveDecisionTargetId`. Any new per-round field needs to be cleared here too, or it leaks into the next round.

## Key domains & their agents

- **Executive decisions** (leader's choice each round — bar a player, grant immunity, etc.): see `.claude/agents/executive-decisions.md` for the full contract. Touches `decision.ts`, `LeaderDecisionPanel.tsx`, reveal timing in `pages/host/[code].tsx`.
- **Status-based music**: see `.claude/agents/music.md`. Touches `useStatusMusic.ts`, asset keying via `NEXT_PUBLIC_AUDIO_OBJECT_*` env vars.
- **Core game flow / phase transitions**: see `.claude/agents/core-game-flow.md`. Touches `update.ts`, `vote.ts`, `config/phases.ts`, timer logic, and the large orchestration pages `pages/host/[code].tsx` (~780 lines) and `pages/player/[code].tsx` (~440 lines).

When work clearly falls in one of these domains, prefer delegating to that agent — they carry hard constraints (e.g. never leak barred identities before reveal gates) that are easy to violate with a generic edit.

## Abuse guarding

`server/abuseGuard.ts` rate-limits game creation and joins per IP (`MAX_CREATE_PER_WINDOW`, `MAX_JOIN_PER_WINDOW`, `MAX_ACTIVE_GAMES_PER_IP`, window sizes via env). `MVP_HOST_ACCESS_KEY` is a shared-secret gate on hosting — a stopgap for the friends MVP, not real auth. When SSO is added later, this key-based gate should be replaced, not layered under.

## Live status / roadmap

`.github/prompts/plan-hallucinate.prompt.md` is the running plan doc — phases, decisions log with rationale, and a verification checklist. Check it for current MVP status before assuming what's done vs. pending.

## Current MVP → future B2C

Don't build SSO, payments, or accounts now — they're future scope. But keep these constraints in mind so current work doesn't need to be undone:
- Persistence must become "always durable, no silent memory fallback" once real accounts/payments exist.
- Host identity is currently implicit (first connected socket becomes admin); a real host account will need to be a first-class concept, not inferred from connection order.
- Player join/play flow is already no-login and phone-first by design — preserve that.
