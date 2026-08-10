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
}

export interface GameRound {
  roundNumber: number
  leader: string // Player ID
  barred: string[] // Array of barred player IDs
  votes: Record<string, string[]> // { voterId: [candidateId, candidateId, ...] } ranked ballots for the round
  roundStartTime: number // timestamp
}

export type StatusTypes = 'join' | 'rules' | 'campaign' | 'vote' | 'results' | 'decision' | 'announcement' | 'final'

// Player-facing phase (Rule of Three): campaign / election / executive / final
export type PhaseTypes = 'campaign' | 'election' | 'executive' | 'final'

export type ExecutiveDecisionType = 'bar_another' | 'self_immunity_next_cycle' | 'grant_immunity_next_cycle' | 'opt_out'

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
  executiveDecisionTargetId?: string // Player ID barred by ED1
  // Computed fields for efficient lookups
  adminPlayerId?: string // ID of the player with isAdmin = true
  currentBarredPlayerIds?: string[] // IDs of players barred in current round
  phase?: PhaseTypes // Player-facing phase derived from status (computed, not stored)
}

export interface GameStore {
  [id: string]: Game
}

export interface PlayerProjection {
  code: string
  status: StatusTypes
  phase?: PhaseTypes // Player-facing phase for display
  contentKey: StatusTypes
  session: {
    playerId: string
    playerName: string
  }
  actions: {
    canVote: boolean
    canDecide: boolean
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
  }
  admin?: {
    canStartGame: boolean
    startBlockedReason?: string
    connectedPlayers: number
    minPlayersRequired: number
  }
}
