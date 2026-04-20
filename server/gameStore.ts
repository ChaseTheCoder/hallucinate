import { Game, GameStore } from '../types/types'
import { Pool } from 'pg'

// Simple in-memory game store
export const games: GameStore = {}

const DATABASE_URL = process.env.NODE_ENV === 'development'
  ? (process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL)
  : process.env.DATABASE_URL

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    })
  : null
let dbReady = false
let dbDisabledForSession = false

async function ensureDbReady() {
  if (!pool || dbReady || dbDisabledForSession) return

  try {
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS games_state (
          code TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
    )
  } catch (error: unknown) {
    const err = error as { code?: string; hostname?: string; message?: string }
    if (err?.code === 'ENOTFOUND' && process.env.NODE_ENV === 'development') {
      dbDisabledForSession = true
      console.warn(
        `[DB] Database host not found (${err.hostname || 'unknown host'}). ` +
        `Falling back to in-memory store for this local dev session. ` +
        `Use Render's EXTERNAL database URL in DATABASE_URL_LOCAL for persistent local testing.`
      )
      return
    }
    throw error
  }

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

async function gameCodeExists(code: string): Promise<boolean> {
  const inMemoryExists = Object.values(games).some(g => g.code === code)
  if (inMemoryExists) return true

  if (!pool || dbDisabledForSession) return false

  await ensureDbReady()
  if (dbDisabledForSession) return false
  const result = await pool.query('SELECT 1 FROM games_state WHERE code = $1 LIMIT 1', [code])
  return result.rowCount > 0
}

export async function createGame(): Promise<Game> {
  const id = crypto.randomUUID()
  let code = makeCode()
  while (await gameCodeExists(code)) {
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

  if (!pool || dbDisabledForSession) return
  await ensureDbReady()
  if (dbDisabledForSession) return
  await pool.query(
    `
      INSERT INTO games_state (code, payload, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (code)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `,
    [game.code, JSON.stringify(game)]
  )
}

export async function deletePersistedGame(code: string): Promise<void> {
  const gameId = Object.keys(games).find(id => games[id].code === code)
  if (gameId) {
    delete games[gameId]
  }

  if (!pool || dbDisabledForSession) return
  await ensureDbReady()
  if (dbDisabledForSession) return
  await pool.query('DELETE FROM games_state WHERE code = $1', [code])
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

  if (!pool || dbDisabledForSession) return null

  await ensureDbReady()
  if (dbDisabledForSession) return null
  const result = await pool.query<{ payload: unknown }>('SELECT payload FROM games_state WHERE code = $1 LIMIT 1', [code])
  if (!result.rows?.length) return null

  const loaded = normalizeLoadedGame(result.rows[0]?.payload)
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