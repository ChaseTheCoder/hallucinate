export interface Player {
  id: string // UUID
  name: string
  votes: number
  leader: boolean
  isQualified: boolean // Can't gain voting points
  roundsBarred: number // Track how many rounds barred (for special privileges)
  isAdmin: boolean
  hasVoted: boolean // Track if player has voted in current round
  isConnected: boolean // Track if player is currently connected
}

export interface GameRound {
  roundNumber: number
  leader: string // Player ID
  barred: string[] // Array of barred player IDs
  votes: Record<string, number[]> // { playerId: [5, 3, 1, ...] } for each round's votes
  roundStartTime: number // timestamp
}

export type StatusTypes = 'join' | 'rules' | 'campaign' | 'vote' | 'results' | 'decision' | 'announcement' | 'final'

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
  // Computed fields for efficient lookups
  adminPlayerId?: string // ID of the player with isAdmin = true
  currentBarredPlayerIds?: string[] // IDs of players barred in current round
}

export interface GameStore {
  [id: string]: Game
}
