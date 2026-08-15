// Rolled exactly once, automatically, the moment a player transitions qualified -> barred
// (see server/barredInfluence.ts, the single shared assignment point). 'bar_leader' and
// 'grant_immunity' each come with a generated ActiveRoundCode; 'post' has no code. Lost
// (and re-rolled fresh on a future bar) the instant the player requalifies — see
// clearBarredInfluence in server/barredInfluence.ts.
export type BarredInfluenceType = 'bar_leader' | 'grant_immunity' | 'post'

export interface Player {
  id: string // UUID
  name: string
  votes: number
  leader: boolean
  isQualified: boolean // Can't gain voting points
  immuneFromBarInRound?: number // Round index where this player cannot be barred
  roundsBarred: number // Track how many rounds barred (for special privileges)
  isAdmin: boolean
  hasVoted: boolean // Track if player has voted in current round
  isConnected: boolean // Track if player is currently connected
  // Barred-player influence (see BarredInfluenceType). Undefined for qualified players and
  // for barred players who haven't been assigned one yet (shouldn't happen post-assignment,
  // but stays optional since it's cleared to undefined on requalify).
  influence?: BarredInfluenceType
  // Has the player dismissed the announcement-phase Popover explaining their CURRENT
  // influence? Server-persisted (not local component state) so it survives reconnects/app
  // reopens — see the Popover in pages/player/[code].tsx. Reset to false on every fresh
  // influence roll; cleared to undefined (along with `influence`) on requalify.
  influenceAcknowledged?: boolean
  // 'post' influence only. Fixed once confirmed, persists across campaign cycles for as
  // long as the player holds 'post' influence — never their real name, that's the point of
  // the mechanic (see host-side post feed in pages/host/[code].tsx).
  postAlias?: string
  // 'post' influence only. This cycle's submitted post text (<=180 chars), attributed by
  // postAlias on the host screen during 'campaign'. Cleared at announcement -> campaign
  // (see update.ts) so posts never carry over rounds.
  currentPost?: string
  // 'post' influence only. One post per campaign cycle — reset to false at announcement ->
  // campaign alongside currentPost.
  hasPostedThisCycle?: boolean
}

export interface GameRound {
  roundNumber: number
  leader: string // Player ID
  barred: string[] // Array of barred player IDs
  votes: Record<string, string[]> // { voterId: [candidateId, candidateId, ...] } ranked ballots for the round
  roundStartTime: number // timestamp
}

export type StatusTypes = 'join' | 'intro' | 'rules' | 'campaign' | 'vote' | 'results' | 'decision' | 'announcement' | 'final'

// Player-facing phase (Rule of Three): campaign / election / executive / final
export type PhaseTypes = 'campaign' | 'election' | 'executive' | 'final'

// 'opt_out' is not leader-facing (never shown as a menu option) — it is the internal
// fallback value auto-submitted by the player client when qualified players <= 3 (see
// handleBarSubmit in LeaderDecisionPanel.tsx), representing "no executive decision this
// round". The three leader-facing decisions:
//  - immunity_code: leader generates a 4-letter code redeemable for immunity next cycle.
//  - requalify_code: leader generates a 4-letter code redeemable to requalify a barred player.
//  - barred_swap_chance: leader picks an already-barred player to get a 25s window (during
//    the announcement reveal) to bar a qualified player in their place and become qualified.
export type ExecutiveDecisionType = 'immunity_code' | 'requalify_code' | 'barred_swap_chance' | 'opt_out'

// 'immunity' / 'requalify': leader-granted (immunity_code / requalify_code executive
// decisions), open to redemption by anyone but the owner, round-scoped (see
// `validForRound` below).
// 'bar_leader' / 'grant_immunity': barred-player-granted (see BarredInfluenceType /
// server/barredInfluence.ts), restricted to a specific eligibility (see CodeEligibility),
// NOT round-scoped — they remain active across campaign cycles until redeemed or the
// holder's influence is lost.
export type ActiveCodeType = 'immunity' | 'requalify' | 'bar_leader' | 'grant_immunity'

// Who is allowed to redeem a given code, checked server-side in redeem-code.ts. An
// ineligible-but-otherwise-correct submission must be treated identically to a wrong code
// (same generic error) — never leak that a code exists but the submitter can't use it.
// 'any' = anyone but the owner (existing immunity_code/requalify_code behavior).
// 'leader' = only the current leader (bar_leader).
// 'qualified' = any currently-qualified player, leader included (grant_immunity).
export type CodeEligibility = 'any' | 'leader' | 'qualified'

// A 4-letter redemption code. `code` must never be broadcast to the host or to any player
// other than `ownerId` (see sanitizeGameForHost / buildPlayerProjection in
// server/gameStore.ts) — and its `type` must never be revealed to anyone but the owner
// either (see ActiveCodeDisplay's deliberately type-agnostic copy).
export interface ActiveRoundCode {
  code: string
  type: ActiveCodeType
  ownerId: string // player id who generated/was granted this code; cannot redeem their own code
  eligibility: CodeEligibility
  // Leader-granted codes (immunity/requalify) are scoped to exactly one campaign cycle and
  // cleared unconditionally at campaign -> vote (see update.ts), whether redeemed or not —
  // matches game.currentRound during that campaign phase. Barred-player-granted codes
  // (bar_leader/grant_immunity) have no round expiry; this stays undefined for those.
  validForRound?: number
  // Set true at the instant of a successful redemption; entries are filtered out of
  // game.activeCodes immediately after (freeing bar_leader/grant_immunity scarcity for
  // future rolls), so in practice every entry present in the array has consumed === false.
  consumed: boolean
}

export type SwapWindowStatus = 'pending' | 'active' | 'resolved' | 'expired'

// Per-round state for the barred_swap_chance decision. `barredPlayerId` identifies which
// already-barred player the leader gave a redemption chance to — this identity is only
// narrated (revealed) once the host's announcement sequence reaches that line, but is
// otherwise safe to include in the host payload (it is not a "which player is on the
// ballot" leak the way barring is, since that player was already publicly barred in a
// prior round). `status` starts 'pending' at decision-submit time, becomes 'active' (with
// a server-set `deadline`) when the host narration reaches the pause point, then either
// 'resolved' (the barred player submitted a swap target in time) or 'expired' (25s elapsed
// with no submission).
export interface SwapWindow {
  barredPlayerId: string
  status: SwapWindowStatus
  deadline?: number // epoch ms; set when status becomes 'active'
  resultQualifiedTargetId?: string // the player barred in exchange, once resolved
}

export interface Game {
  id: string // UUID
  code: string
  started: boolean
  status: StatusTypes
  cycleTime: number // seconds between elections (set by host)
  players: Player[]
  rounds: GameRound[]
  currentRound: number
  electionCycleStartTime: number // timestamp for countdown
  winner?: string | undefined; // Player ID of winner
  createdAt: number
  // Executive decision fields (set after leader submits decision)
  executiveDecision?: ExecutiveDecisionType
  // Every currently-active redemption code in the game (see ActiveRoundCode) — a
  // collection, not a single slot, because multiple codes of different types/owners can be
  // active simultaneously (e.g. one barred player holding an unredeemed bar_leader code
  // while another holds an unredeemed grant_immunity code, alongside a leader-granted
  // immunity_code/requalify_code). Leader-granted entries survive the announcement ->
  // campaign round reset on purpose (they become redeemable during that very campaign
  // phase) and are cleared at campaign -> vote instead; barred-player-granted entries have
  // no round expiry and persist until redeemed or the holder's influence is lost.
  activeCodes: ActiveRoundCode[]
  // Live state for an in-progress barred_swap_chance decision. Cleared at
  // announcement -> campaign like other per-round executive-decision fields.
  swapWindow?: SwapWindow
  // Computed fields for efficient lookups
  adminPlayerId?: string // ID of the player with isAdmin = true
  currentBarredPlayerIds?: string[] // IDs of players barred in current round
  phase?: PhaseTypes // Player-facing phase derived from status (computed, not stored)
  // Permanent, one-time flag for the "barred candidate twist" round (see update.ts's
  // campaign -> vote transition, the only place this gets set). The FIRST time qualified
  // players hit exactly 3 AND at least 2 players are already barred, that round's Vote/
  // Election phase asks players to vote among BARRED candidates instead of qualified ones;
  // the winner requalifies and is crowned leader (see vote.ts). Once true, this never
  // resets and the twist never fires again for the rest of the game — deliberately NOT
  // cleared by the announcement -> campaign per-round reset in update.ts. If the
  // qualified-count-3 condition is met but fewer than 2 players are barred yet, this stays
  // false so the twist remains eligible on some later occasion (still may never fire —
  // that's an acceptable outcome).
  hasTriggeredBarredCandidateTwist: boolean
  // Set to game.currentRound at the exact moment the twist fires (alongside
  // hasTriggeredBarredCandidateTwist flipping to true), identifying which round is the
  // twist round. Consumers check `game.activeTwistRound === game.currentRound` rather than
  // re-deriving "is this the twist round" from qualified-player counts, since the winner's
  // requalification bumps qualified count from 3 -> 4 mid-round (before their own bar
  // choice brings it back to 3) and a live count-based check would get confused by that.
  // Never needs explicit clearing: currentRound increments at the next announcement ->
  // campaign transition, so the equality check naturally goes false for every future round.
  activeTwistRound?: number
}

export interface GameStore {
  [id: string]: Game
}

export interface PlayerProjection {
  code: string
  status: StatusTypes
  phase?: PhaseTypes // Player-facing phase for display
  contentKey: StatusTypes
  // Count only (never the roster) of currently-qualified players — safe to expose to every
  // player regardless of reveal timing, since it doesn't identify anyone. Used client-side to
  // know when the "no codes are valid at <=3 qualified players" rule (see redeem-code.ts) is
  // in effect, without needing to guess from other gated state.
  qualifiedCount: number
  session: {
    playerId: string
    playerName: string
  }
  actions: {
    canVote: boolean
    canDecide: boolean
    canResolveSwap: boolean
  }
  vote?: {
    hasSubmitted: boolean
    requiredVotes: number
    candidates: Array<{
      id: string
      name: string
    }>
  }
  decision?: {
    candidates: Array<{
      id: string
      name: string
    }>
    // Currently-barred players (from prior rounds), needed client-side to determine
    // eligibility of requalify_code / barred_swap_chance and, for the latter, as the
    // leader's target list. Never includes the player being barred this round (that bar
    // hasn't been confirmed/broadcast yet at decision-submit time).
    barredCandidates: Array<{
      id: string
      name: string
    }>
  }
  // Present only for the specific player who owns an unredeemed code (leader-granted or
  // barred-influence-granted — see ActiveRoundCode), and only during the campaign phase.
  // `type` is included for server-side bookkeeping but ActiveCodeDisplay deliberately never
  // renders it — never sent to the host or to any other player.
  activeCode?: {
    code: string
    type: ActiveCodeType
  }
  // Present only for the specific barred player currently holding an active
  // barred_swap_chance window. Never sent to the host or to any other player.
  swapWindow?: {
    deadline: number
    candidates: Array<{
      id: string
      name: string
    }>
  }
  // Present whenever the player currently has a barred influence (see BarredInfluenceType)
  // — independent of game.status, so the announcement-phase Popover in
  // pages/player/[code].tsx can durably show it whenever the player opens the app while
  // `acknowledged` is false, regardless of how many rounds have passed since they were
  // barred. Never sent to the host or to any other player.
  influence?: {
    type: BarredInfluenceType
    acknowledged: boolean
  }
  // Present only when the player currently holds 'post' influence. `alias` is undefined
  // until they've confirmed one (first-visit prompt); once set it's permanent for as long
  // as they hold the influence. `hasPostedThisCycle` gates the compose box and resets at
  // announcement -> campaign. Never sent to the host or to any other player (attribution on
  // the host screen is by alias only, see Right/PostFeed).
  post?: {
    alias?: string
    hasPostedThisCycle: boolean
  }
  admin?: {
    canStartGame: boolean
    startBlockedReason?: string
    connectedPlayers: number
    minPlayersRequired: number
  }
}
