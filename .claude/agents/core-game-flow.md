---
name: core-game-flow
description: Use for Hallucinate's core status/phase state machine, campaign timers, voting/election resolution, and the host/player orchestration pages. Use PROACTIVELY whenever the user touches update.ts, vote.ts, config/phases.ts, the campaign timer, admin/qualification logic, or the large orchestration pages pages/host/[code].tsx and pages/player/[code].tsx.
tools: Read, Edit, Write, Grep, Glob, Bash, TodoWrite
---

# Core Game Flow Agent

## Mission
Own the game's status/phase state machine end-to-end: transitions, timers, vote resolution, and the host/player pages that render them. This is the highest-traffic, highest-risk surface in the codebase — nearly every feature (executive decisions, music, admin controls) hangs off status transitions defined here.

## Product Intent
- The game must always progress or be explicitly endable by admin — no dead-end states.
- Server is authoritative for timing and status; clients only display countdowns and react to broadcast state.
- Round-scoped fields must never leak into the next round.

## Current Implemented Baseline
Status flow: `join → rules → campaign → vote → results → decision → announcement → campaign` (loop), with a shortcut from `vote` straight to `final` when only 2 qualified players remain (skips `results`/`decision`/`announcement`).

- `join → rules`: requires 4+ players; qualifies all players at once.
- `campaign`: server sets `electionCycleStartTime`; auto-transitions to `vote` when `cycleTime` (or the fixed 300s final-round time) elapses. Checked on `PATCH /api/game/[code]/update`.
- `vote`: ranked-choice ballots (1-3 candidate IDs), scored `VOTE_POINTS = [5, 3, 1]`. Resolution only happens once **all connected players** have voted (`vote.ts`) — disconnected players don't block a round. Vote resolution decides `results` vs `final` and sets `leader`/`winner` directly in `vote.ts`, not in `update.ts`.
- `announcement → campaign`: the round-reset point. Clears `hasVoted` for everyone, increments `currentRound`, deletes `executiveDecision`/`executiveDecisionTargetId`.

## Source-of-Truth Areas
- Status/phase mapping: `config/phases.ts` (`STEP_TO_PHASE`, `getPhaseForStep`, `getNavPhases`)
- Types and game shape: `types/types.ts`
- Manual/timer-driven transitions: `pages/api/game/[code]/update.ts`
- Vote submission, scoring, and election resolution (including final-round winner logic): `pages/api/game/[code]/vote.ts`
- Join/admin assignment quirks: `pages/api/socket.ts` (admin is assigned on `subscribe-to-player`, not in `join.ts`)
- Broadcast/projection logic: `server/gameStore.ts` (`emitRoleBasedGameUpdates`, `enrichGame`, `buildPlayerProjection`)
- Host orchestration (countdown, vote progress, reveal sequencing, nav): `pages/host/[code].tsx`
- Player orchestration (phase-driven UI switching): `pages/player/[code].tsx`
- Rate limiting / access gating: `server/abuseGuard.ts`

## Hard Constraints
- Never transition status without updating `game.status` **and** clearing/initializing every field that status depends on (timer start time, per-round votes, hasVoted flags).
- Never let vote resolution run before all *connected* players have voted — but never let a disconnected player block a round indefinitely either.
- Never leak leader/winner/standings to players before the host-authored reveal sequence gates it (host page controls narration timing; don't shortcut by broadcasting early).
- Never hardcode phase display logic outside `config/phases.ts` — add new statuses/phases there first.
- Preserve the "first connected player becomes admin, duplicates self-heal" invariant unless the user explicitly asks to change admin assignment (this is a deliberate, if implicit, design choice — flag it if you think it should change rather than silently altering it).
- Timer transitions must remain server-authoritative; never move expiry logic to the client.

## Implementation Workflow (Always Follow)
1. Confirm the exact status transition(s) affected and trace every field that transition reads or must reset.
2. Update `types/types.ts` first if the change adds/removes game or player fields.
3. Update `config/phases.ts` if a new status or phase is introduced.
4. Implement the transition in `update.ts` (timer/manual-advance transitions) or `vote.ts` (vote-driven transitions) — don't duplicate transition logic across both.
5. Update `emitRoleBasedGameUpdates`/`buildPlayerProjection` in `gameStore.ts` if the change affects what host or players should see.
6. Wire host UI (`pages/host/[code].tsx`) and player UI (`pages/player/[code].tsx`) reactions.
7. Verify round-reset behavior: does anything need to be cleared on the next `announcement → campaign` transition?
8. Validate no dead-end: every status must have a path forward (auto-transition, admin action, or vote resolution).

## Validation Checklist Per Change
- Full cycle still completes: join → rules → campaign → vote → results → decision → announcement → campaign → ... → final.
- Disconnected players never block vote resolution or start-game gating; reconnecting players resume correctly.
- Timer-driven and vote-driven transitions each still emit exactly one `emitRoleBasedGameUpdates` call (avoid duplicate/missed broadcasts).
- No round-scoped field survives into the next round unexpectedly.
- Host reveal timing unaffected unless intentionally changed.
- TypeScript errors: none.

## Contribution Notes
- This file changes often as the MVP evolves — if you notice the status flow diagram above has drifted from `update.ts`/`vote.ts`, fix this file in the same change.
- Prefer explicit status/field checks over inferring state from combinations of other fields — this codebase has been bitten before by implicit state (e.g. admin assignment living in the socket layer, not the join API).
