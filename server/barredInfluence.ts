import { ActiveRoundCode, BarredInfluenceType, Game, Player } from '../types/types'
import { generateUniqueCode } from './codeGenerator'

function isBarLeaderAvailable(game: Game): boolean {
  return !(game.activeCodes ?? []).some(c => c.type === 'bar_leader' && !c.consumed)
}

function isGrantImmunityAvailable(game: Game): boolean {
  return !(game.activeCodes ?? []).some(c => c.type === 'grant_immunity' && !c.consumed)
}

// Weighted roll, filtered by current game-wide scarcity of Bar/Immunity (see the "Random
// influence assignment" spec):
//   both available:        Bar 45% / Immunity 45% / Post 10%
//   exactly one available: that one 90% / Post 10%
//   neither available:     Post 100%
function rollInfluence(game: Game): BarredInfluenceType {
  const barAvailable = isBarLeaderAvailable(game)
  const immunityAvailable = isGrantImmunityAvailable(game)
  const roll = Math.random()

  if (barAvailable && immunityAvailable) {
    if (roll < 0.45) return 'bar_leader'
    if (roll < 0.90) return 'grant_immunity'
    return 'post'
  }

  if (barAvailable || immunityAvailable) {
    if (roll < 0.90) return barAvailable ? 'bar_leader' : 'grant_immunity'
    return 'post'
  }

  return 'post'
}

// The single shared assignment point — call exactly once, at the moment a player
// transitions qualified -> barred (see pages/api/game/[code]/decision.ts's primary bar,
// pages/api/game/[code]/swap.ts's barred_swap_chance outcome, and
// pages/api/game/[code]/redeem-code.ts's bar_leader effect). Rolls a fresh influence,
// resets the announcement-popover acknowledgment flag so it shows again, clears any
// leftover 'post' fields from a prior stint holding that influence, and — for
// bar_leader/grant_immunity — mints and registers a new ActiveRoundCode (no round expiry;
// see ActiveRoundCode) the player can hand out during a future campaign phase.
//
// Every caller flips the player's isQualified to false before calling this, so the
// qualified-count check below already reflects the post-bar state. Once that count is 4 or
// fewer, this player (and — since barring only ever decreases the count further — every
// player barred after them) gets no influence at all: no roll, no code, nothing.
export function assignBarredInfluence(game: Game, player: Player): void {
  if (!Array.isArray(game.activeCodes)) game.activeCodes = []

  const qualifiedCount = game.players.filter(p => p.isQualified).length
  if (qualifiedCount <= 4) return

  const influence = rollInfluence(game)
  player.influence = influence
  player.influenceAcknowledged = false
  player.postAlias = undefined
  player.currentPost = undefined
  player.hasPostedThisCycle = false

  if (influence === 'bar_leader' || influence === 'grant_immunity') {
    const code: ActiveRoundCode = {
      code: generateUniqueCode(game),
      type: influence,
      ownerId: player.id,
      eligibility: influence === 'bar_leader' ? 'leader' : 'qualified',
      consumed: false,
    }
    game.activeCodes.push(code)
  }
}

// Call whenever a player transitions barred -> qualified (requalify_code / grant by
// barred_swap_chance resolution). Per the announcement-popover copy ("If you become
// qualified again you lose this influence"), clears their influence/post fields and, if
// they were still holding an unredeemed bar_leader/grant_immunity code, removes it from
// game.activeCodes so that scarcity slot frees up for a future roll.
export function clearBarredInfluence(game: Game, player: Player): void {
  if (!Array.isArray(game.activeCodes)) game.activeCodes = []
  game.activeCodes = game.activeCodes.filter(c => !(c.ownerId === player.id && !c.consumed))
  player.influence = undefined
  player.influenceAcknowledged = undefined
  player.postAlias = undefined
  player.currentPost = undefined
  player.hasPostedThisCycle = undefined
}
