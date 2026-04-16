import { Game, GameStore } from '../types/types'

// Simple in-memory game store
export const games: GameStore = {}

function makeCode(len: number = 4): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  let s = ''
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)]
  }
  return s
}

export function createGame(): Game {
  const id = crypto.randomUUID()
  let code = makeCode()
  while (Object.values(games).some(g => g.code === code)) {
    code = makeCode()
  }
  const game: Game = {
    id,
    code,
    started: false,
    status: 'join',
    cycleTime: 60,
    players: [],
    rounds: [],
    currentRound: 0,
    electionCycleStartTime: 0,
    winner: undefined,
    createdAt: Date.now(),
    adminPlayerId: undefined,
  }
  games[id] = game
  return game
}

/**
 * Enrich a game object with computed fields for efficient client rendering
 * Adds: adminPlayerId, currentBarredPlayerIds
 */
export function enrichGame(game: Game): Game {
  return {
    ...game,
    adminPlayerId: game.players.find(p => p.isAdmin)?.id ?? undefined,
    currentBarredPlayerIds: game.rounds[game.currentRound]?.barred ?? []
  }
}