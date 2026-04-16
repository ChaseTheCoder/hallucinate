## Plan: Refine Hallucinate Game MVP for Bug-Free Experience

Implement timers, complete final election flow, reset vote states, add visual indicators, and secure admin controls to ensure smooth game progression without user traps or errors.

**Current Status: Phase 3 Complete ✅**

**Completed Phases**

**Phase 1: Core Game Flow Fixes ✅**
1. ✅ Implement campaign timer with server-side start time tracking and auto-transition to vote when time expires
2. ✅ Add final election completion logic: after final vote, determine winner and transition to complete status
3. ✅ Set winner field in game state based on highest votes in final round, handling ties by selecting first qualified player
4. ✅ Reset hasVoted flags and vote counts when transitioning back to campaign for new rounds
5. ✅ Enforce minimum player count (4+) before allowing game start from join to rules

**Phase 2: UI Enhancements ✅**
1. ✅ Display real-time countdown on host screen replacing {TIME} placeholder and on player screens during campaign
2. ✅ Show vote progress counter on host screen (e.g., "3/6 players have voted")
3. ✅ Add visual indicators for barred players (Move player name to below qualified players with grayed out styling under a title "Barred" with most recently barred at the top. Keep still eligible players in white with gray text in order they joined.)
4. ✅ Implement complete status UI with winner announcement and redirect logic for players

**Additional Improvements ✅**
- ✅ Disable "Start Game" button until 4+ players have joined (shows current count vs required minimum)

**Phase 3: Error Handling and Edge Cases ✅**
1. ✅ Handle player disconnect during vote by updating vote completion check to only require votes from all current (connected) players
2. ✅ Improve error messages and recovery flows for network issues
3. ✅ Add player reconnection tracking and automatic reconnection handling
4. ✅ Add descriptive error messages with recovery actions for voting failures

**Remaining Phases**

**Phase 4: Admin and Security**
1. Add role checks to admin-only endpoints (update, delete) to prevent unauthorized state changes
2. Improve admin handoff notifications when admin leaves and new admin is assigned
3. Remove redundant results endpoint since vote.ts already handles election computation
4. Make campaign time configurable by admin during join phase (max 10 minutes)

**Relevant files**
- `server/gameStore.ts` — ✅ Added timer fields, winner tracking, vote reset logic
- `pages/api/game/[code]/update.ts` — ✅ Implemented timer checks and auto-transitions
- `pages/api/game/[code]/vote.ts` — ✅ Added final completion logic, reset hasVoted, update vote completion check; ✅ Added error handling with recovery actions
- `pages/host/[code].tsx` — ✅ Added countdown display, vote progress, barred indicators
- `pages/player/[code].tsx` — ✅ Added countdown, complete status UI, start game button disable logic
- `content/content.ts` — ✅ Updated messages for complete status and timer placeholders
- `types/types.ts` — ✅ Added isConnected field to Player interface
- `pages/api/socket.ts` — ✅ Added disconnect/reconnect handling with player connection state tracking
- `pages/api/game/[code]/join.ts` — ✅ Initialize isConnected field for new players
- `pages/api/game/[code]/delete.ts` — Add admin check
- `pages/api/game/[code]/results.ts` — Remove redundant endpoint

**Verification**
1. ✅ Run full game cycle test: create game → join players → start → campaign (with timer) → vote → results → decision → announcement → repeat until final → complete
2. ✅ Verify timers auto-transition phases and display correctly on all screens
3. ✅ Test live updates: host screen shows real-time player status, vote progress, and countdowns
4. ✅ Check error scenarios: player disconnect mid-vote, admin leaving, network issues
5. ✅ Ensure no infinite loops: game always progresses or can be ended by admin
6. ⏳ Verify disconnected players are excluded from vote completion checks
7. ⏳ Verify error messages display recovery actions to users
8. ⏳ Verify players can reconnect and resume voting

**Decisions**
- ✅ Timer implementation: Server sets start time, clients calculate remaining time for display and server checks for auto-transition
- ✅ Winner determination: Highest total votes in final round; ties broken by first in qualified players array
- ✅ Barred players: Display with grayed out styling and "BARRED" badge in lists
- ✅ Admin controls: First joiner is admin, reassign on leave; API endpoints verify admin status
- ✅ Campaign time: Configurable by admin (1-10 minutes) during join phase, default 10 minutes
- ✅ Minimum players: Require at least 4 players to start game (button disabled until requirement met)
- ✅ Vote completion: Only transition to results when all current (connected) players have submitted votes; disconnected players are excluded from the check
- ✅ Player disconnection: Mark as disconnected on socket disconnect; mark as reconnected on subscribe-to-player re-subscription
- ✅ Error handling: Enhanced error messages with recovery actions for network issues and validation failures
- ✅ Vote endpoint: Automatically mark voter as connected during vote submission (handles reconnection case)
- Persistence: Out of scope for MVP; use in-memory state, add database later

**Further Considerations**
- Phase 4: Admin security (role checks, admin handoff, remove redundant endpoints)
- After MVP: Add database persistence, session management, advanced features
