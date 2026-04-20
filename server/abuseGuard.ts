type WindowState = {
  count: number
  resetAt: number
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

const createWindowByIp = new Map<string, WindowState>()
const joinWindowByIp = new Map<string, WindowState>()
const gameOwnerByCode = new Map<string, string>()

const CREATE_WINDOW_MS = readPositiveInt(process.env.CREATE_WINDOW_MS, 10 * 60 * 1000)
const JOIN_WINDOW_MS = readPositiveInt(process.env.JOIN_WINDOW_MS, 10 * 60 * 1000)
const MAX_CREATE_PER_WINDOW = readPositiveInt(process.env.MAX_CREATE_PER_WINDOW, 3)
const MAX_JOIN_PER_WINDOW = readPositiveInt(process.env.MAX_JOIN_PER_WINDOW, 40)
const MAX_ACTIVE_GAMES_PER_IP = readPositiveInt(process.env.MAX_ACTIVE_GAMES_PER_IP, 1)
const MVP_HOST_ACCESS_KEY = process.env.MVP_HOST_ACCESS_KEY?.trim() || ''

export function isHostAccessAllowed(hostAccessKey: string | string[] | undefined): boolean {
  if (!MVP_HOST_ACCESS_KEY) return true
  const provided = Array.isArray(hostAccessKey) ? hostAccessKey[0] : hostAccessKey
  if (!provided) return false
  return provided.trim() === MVP_HOST_ACCESS_KEY
}

function bumpWindow(map: Map<string, WindowState>, ip: string, windowMs: number): WindowState {
  const now = Date.now()
  const current = map.get(ip)
  if (!current || now >= current.resetAt) {
    const fresh = { count: 1, resetAt: now + windowMs }
    map.set(ip, fresh)
    return fresh
  }

  current.count += 1
  return current
}

export function checkCreateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const state = bumpWindow(createWindowByIp, ip, CREATE_WINDOW_MS)
  if (state.count > MAX_CREATE_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - Date.now()) / 1000))
    }
  }

  const activeByIp = Array.from(gameOwnerByCode.values()).filter(ownerIp => ownerIp === ip).length
  if (activeByIp >= MAX_ACTIVE_GAMES_PER_IP) {
    return { allowed: false, retryAfterSeconds: 600 }
  }

  return { allowed: true }
}

export function registerGameOwner(code: string, ip: string): void {
  gameOwnerByCode.set(code, ip)
}

export function unregisterGameOwner(code: string): void {
  gameOwnerByCode.delete(code)
}

export function checkJoinLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const state = bumpWindow(joinWindowByIp, ip, JOIN_WINDOW_MS)
  if (state.count > MAX_JOIN_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - Date.now()) / 1000))
    }
  }

  return { allowed: true }
}
