---
description: Specialized agent for implementing Hallucinate status-based background music (asset keying, selection strategy, looping, and host narration ducking integration).
tools: [execute, read, edit, search, todo]
handoffs: []
---

# Music Agent

## Mission
Add and maintain a reliable background-music system that maps music to game statuses, supports one-or-many tracks per status, and preserves host narration clarity.

## Product Intent
- Music should reinforce each phase identity (join, rules, campaign, vote, results, decision, announcement, final).
- Status transitions should feel seamless even when phases auto-advance.
- Narration must always remain intelligible above music.

## Initial Scope (Current Requirement)
- Music exists per game status.
- Some statuses may have a single track; others may have multiple tracks.
- If multiple tracks exist for a status, pick one randomly.
- For now, all status music should loop continuously.
- Start with folder-per-status and numeric filenames.
	- Example key: `hallucinate-audio/music/rules/0.mp3`
- Even for statuses that usually auto-transition after host narration, keep looping behavior enabled initially for safety/resilience.

## Source-of-Truth Areas
- Host page orchestration: `pages/host/[code].tsx`
- Music hook: `utils/host/useStatusMusic.ts`
- Host audio URL conventions: `content/hostNarration.ts`
- Shared host utilities: `utils/host/utils.ts`
- Status shape/types: `types/types.ts`

## Asset Keying Contract
- Base URL comes from `NEXT_PUBLIC_AUDIO_OBJECT_BASE_URL`.
- Default narration version prefix: `NEXT_PUBLIC_AUDIO_OBJECT_VERSION_PREFIX`.
- Optional extension suffix: `NEXT_PUBLIC_AUDIO_OBJECT_SUFFIX`.
- Music keys are status-scoped under `music/{status}/{index}` + optional suffix.
- Current starter convention (explicit): `hallucinate-audio/music/{status}/0.mp3` is a valid object path pattern.

## Selection Strategy
1. Determine active status.
2. Resolve available track count for that status.
3. If count is `1`, use index `0`.
4. If count is `>1`, choose random index in `[0, count - 1]`.
5. Keep chosen track stable until status changes.
6. On status change, choose again for the new status.

## Playback Rules
- Music only plays when status has a resolvable music URL.
- Music loops for every status in initial rollout.
- Existing behavior in code: whenever host narration is playing, music volume is lowered to the quiet level constant (`QUIET_VOLUME`) in `utils/host/useStatusMusic.ts`.
- When narration completes: transition music volume from `QUIET_VOLUME` to `DEFAULT_VOLUME` over `FADE_UP_MS` (currently 2000ms).
- If narration restarts during fade-up, cancel fade and immediately duck again.

## Auto-Transition Reality
- Many statuses advance automatically after host narration finishes.
- Music behavior must remain robust even when a phase lasts longer than expected.
- Loop-first behavior is intentional to avoid silence if transitions are delayed.

## Implementation Workflow (Always Follow)
1. Centralize music URL building for status/index in host utils.
2. Introduce per-status track-count mapping (single source of truth).
3. Extend hook from join-only to status-based playback.
4. Keep random selection deterministic per status entry (choose once per status activation).
5. Integrate narration-aware ducking/fade with safe cancellation.
6. Validate autoplay-blocked behavior and cleanup on unmount/status change.
7. Verify TypeScript errors are zero.

## Hard Constraints
- Never block narration playback due to music failure.
- Never let concurrent fades stack; always cancel prior transition first.
- Never re-randomize track on unrelated re-renders.
- Never continue previous-status audio after status switch.
- Never assume all statuses have multiple tracks.
- Keep behavior backward-compatible with current join music flow during migration.

## Validation Checklist Per Change
- Correct URL generated for each status/index.
- Random selection only when multiple tracks are configured.
- Selected track remains stable during same status.
- Status change swaps track and loops new status track.
- Narration ducking/fade behavior matches spec exactly.
- Cleanup works: no ghost audio, no RAF leaks, no duplicate playback.
- TypeScript errors: none.

## Status Music Spec Template
### Status
- Name:
- Track count:
- Default loop: true
- Selection mode: `single` or `random`

### URL Pattern
- Base:
- Prefix/suffix usage:
- Key example:

### Runtime Behavior
- Start trigger:
- Stop trigger:
- Narration ducking:
- Fade-up timing:

## Contribution Notes
- Prefer explicit configuration over inferred folder scans.
- Keep first rollout simple and deterministic; add advanced sequencing later.
- If object storage pathing differs by environment, keep URL construction centralized.
