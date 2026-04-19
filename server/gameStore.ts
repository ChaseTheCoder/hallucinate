import { Game, GameStore } from '../types/types'
import { neon } from '@neondatabase/serverless'

// Simple in-memory game store
export const games: GameStore = {}

const DATABASE_URL = process.env.DATABASE_URL
const sql = DATABASE_URL ? neon(DATABASE_URL) : null
let dbReady = false

async function ensureDbReady() {
  if (!sql || dbReady) return

  await sql`
    CREATE TABLE IF NOT EXISTS games_state (
      code TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  dbReady = true
}

function makeCode(len: number = 4): string {
  const chars = 'BCDFGHJKMNPQRSTVWXYZ'
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

export async function persistGame(game: Game): Promise<void> {
  games[game.id] = game

  if (!sql) return
  await ensureDbReady()
  await sql`
    INSERT INTO games_state (code, payload, updated_at)
    VALUES (${game.code}, ${JSON.stringify(game)}::jsonb, NOW())
    ON CONFLICT (code)
    DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
  `
}

export async function deletePersistedGame(code: string): Promise<void> {
  const gameId = Object.keys(games).find(id => games[id].code === code)
  if (gameId) {
    delete games[gameId]
  }

  if (!sql) return
  await ensureDbReady()
  await sql`DELETE FROM games_state WHERE code = ${code}`
}

function normalizeLoadedGame(raw: unknown): Game | null {
  if (!raw || typeof raw !== 'object') return null
  const g = raw as Game
  if (!g.id || !g.code) return null

  return {
    ...g,
    players: Array.isArray(g.players) ? g.players : [],
    rounds: Array.isArray(g.rounds) ? g.rounds : [],
    status: g.status || 'join',
    cycleTime: typeof g.cycleTime === 'number' ? g.cycleTime : 60,
    currentRound: typeof g.currentRound === 'number' ? g.currentRound : 0,
    electionCycleStartTime: typeof g.electionCycleStartTime === 'number' ? g.electionCycleStartTime : 0,
    createdAt: typeof g.createdAt === 'number' ? g.createdAt : Date.now()
  }
}

export async function findGameByCode(code: string): Promise<Game | null> {
  const inMemory = Object.values(games).find(g => g.code === code)
  if (inMemory) return inMemory

  if (!sql) return null

  await ensureDbReady()
  const rows = await sql`SELECT payload FROM games_state WHERE code = ${code} LIMIT 1`
  if (!rows?.length) return null

  const loaded = normalizeLoadedGame(rows[0]?.payload)
  if (!loaded) return null

  games[loaded.id] = loaded
  return loaded
}

export function getClientIp(input: string | string[] | undefined): string {
  if (!input) return 'unknown'
  if (Array.isArray(input)) return input[0] || 'unknown'
  return input.split(',')[0].trim() || 'unknown'
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