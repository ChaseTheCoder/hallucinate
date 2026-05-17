import { Game, GameStore, Player, PlayerProjection } from '../types/types'
import { Pool } from 'pg'
import type { Server as SocketIOServer } from 'socket.io'

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
    console.log('[GameStore] Initializing database connection...')
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS games_state (
          code TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
    )
    console.log('[GameStore] Database connection established and table ensured')
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
    console.error('[GameStore] Database initialization error:', err)
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
  // CRITICAL: Store by ID in memory first before DB persist
  games[game.id] = game
  console.log(`[GameStore] Persisting game ${game.code} (${game.id}) with ${game.players.length} players, status: ${game.status}`)

  if (!pool || dbDisabledForSession) {
    console.log(`[GameStore] Skipping database persist for ${game.code} (pool: ${!!pool}, dbDisabled: ${dbDisabledForSession})`)
    return
  }
  
  await ensureDbReady()
  if (dbDisabledForSession) {
    console.log(`[GameStore] Database disabled, skipping persist for ${game.code}`)
    return
  }
  
  try {
    await pool.query(
      `
        INSERT INTO games_state (code, payload, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (code)
        DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `,
      [game.code, JSON.stringify(game)]
    )
    console.log(`[GameStore] Successfully persisted game ${game.code} to database`)
  } catch (error) {
    console.error(`[GameStore] Failed to persist game ${game.code} to database:`, error)
    throw error
  }
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
    status: g.status ?? 'join',
    cycleTime: typeof g.cycleTime === 'number' ? g.cycleTime : 60,
    currentRound: typeof g.currentRound === 'number' ? g.currentRound : 0,
    electionCycleStartTime: typeof g.electionCycleStartTime === 'number' ? g.electionCycleStartTime : 0,
    createdAt: typeof g.createdAt === 'number' ? g.createdAt : Date.now()
  }
}

export async function findGameByCode(code: string): Promise<Game | null> {
  console.log(`[GameStore] findGameByCode called for ${code}, checking ${Object.keys(games).length} games in memory`)
  
  const inMemory = Object.values(games).find(g => g.code === code)
  if (inMemory) {
    console.log(`[GameStore] Found game ${code} (ID: ${inMemory.id}) in memory with ${inMemory.players.length} players, status: ${inMemory.status}`)
    return inMemory
  }

  console.log(`[GameStore] Game ${code} not in memory, checking database...`)

  if (!pool || dbDisabledForSession) {
    console.log(`[GameStore] Database unavailable for game ${code} (pool: ${!!pool}, dbDisabled: ${dbDisabledForSession})`)
    return null
  }

  await ensureDbReady()
  if (dbDisabledForSession) {
    console.log(`[GameStore] Database disabled after ensureDbReady for game ${code}`)
    return null
  }
  
  const result = await pool.query<{ payload: unknown }>('SELECT payload FROM games_state WHERE code = $1 LIMIT 1', [code])
  console.log(`[GameStore] Database query for ${code} returned ${result.rowCount} rows`)
  
  if (!result.rows?.length) return null

  const loaded = normalizeLoadedGame(result.rows[0]?.payload)
  if (!loaded) {
    console.log(`[GameStore] Failed to normalize loaded game for ${code}`)
    return null
  }

  console.log(`[GameStore] Loaded game ${code} (ID: ${loaded.id}) from database with ${loaded.players.length} players, status: ${loaded.status}`)
  games[loaded.id] = loaded
  console.log(`[GameStore] Stored game ${code} in memory, total games: ${Object.keys(games).length}`)
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

export function buildPlayerProjection(game: Game, player: Player): PlayerProjection {
  const qualifiedPlayers = game.players.filter(p => p.isQualified)
  const canVote = game.status === 'vote' && !player.hasVoted
  const canDecide = game.status === 'decision' && player.leader

  const projection: PlayerProjection = {
    code: game.code,
    status: game.status,
    contentKey: game.status,
    session: {
      playerId: player.id,
      playerName: player.name,
    },
    actions: {
      canVote,
      canDecide,
    },
  }

  if (canVote) {
    projection.vote = {
      hasSubmitted: player.hasVoted,
      requiredVotes: Math.min(3, qualifiedPlayers.length),
      candidates: qualifiedPlayers.map(p => ({ id: p.id, name: p.name })),
    }
  }

  if (canDecide) {
    projection.decision = {
      candidates: qualifiedPlayers
        .filter(p => !p.leader)
        .map(p => ({ id: p.id, name: p.name })),
    }
  }

  if (player.isAdmin) {
    const connectedPlayers = game.players.filter(p => p.isConnected).length
    const minPlayersRequired = 4
    const canStartGame = game.status === 'join' && connectedPlayers >= minPlayersRequired
    projection.admin = {
      canStartGame,
      startBlockedReason: canStartGame ? undefined : `Need at least ${minPlayersRequired} connected players to start`,
      connectedPlayers,
      minPlayersRequired,
    }
  }

  return projection
}

export function emitRoleBasedGameUpdates(io: SocketIOServer, game: Game): void {
  const enriched = enrichGame(game)

  io.to(`host-game-${game.code}`).emit('game-state-update', enriched)

  game.players.forEach(player => {
    io.to(`player-${game.code}-${player.name}`).emit('player-projection-update', buildPlayerProjection(enriched, player))
  })
}