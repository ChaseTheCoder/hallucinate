import { Game } from '../types/types'

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// Shared by every call site that mints a 4-letter ActiveRoundCode — the leader-granted
// immunity_code/requalify_code (pages/api/game/[code]/decision.ts) and the barred-player-
// granted bar_leader/grant_immunity (server/barredInfluence.ts) — so two simultaneously
// active codes can never collide. Redemption (redeem-code.ts) matches purely on the code
// string across the whole game.activeCodes collection; a collision would make two
// different codes indistinguishable from each other.
export function generateUniqueCode(game: Game, len: number = 4): string {
  const existing = new Set((game.activeCodes ?? []).map(c => c.code))
  let code = ''
  do {
    code = Array.from({ length: len }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
  } while (existing.has(code))
  return code
}
