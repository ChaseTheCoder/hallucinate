import type { NextApiRequest, NextApiResponse } from 'next'
import { emitRoleBasedGameUpdates, findGameByCode, persistGame } from '../../../../server/gameStore'
import { assignBarredInfluence, clearBarredInfluence } from '../../../../server/barredInfluence'
import type { Server as SocketIOServer } from 'socket.io'
import type { Server as NetServer, Socket } from 'net'
import type { ActiveRoundCode, Player } from '../../../../types/types'

interface SocketServer extends NetServer {
  io?: SocketIOServer
}

interface SocketWithIO extends Socket {
  server: SocketServer
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO
}

interface RedeemCodeSubmission {
  playerId: string
  code: string
}

const INVALID_CODE_ERROR = { error: 'Incorrect code' }

// Whether `player` is allowed to redeem a code with the given eligibility. An
// ineligible-but-otherwise-matching code must be treated identically to a code that
// doesn't exist at all (see CodeEligibility doc in types/types.ts) — the caller is
// responsible for returning the same generic INVALID_CODE_ERROR either way.
function isEligible(eligibility: ActiveRoundCode['eligibility'], player: Player): boolean {
  if (eligibility === 'leader') return player.leader
  if (eligibility === 'qualified') return player.isQualified
  return true // 'any'
}

// Single generic "submit this 4-letter string" endpoint for every code type — leader-
// granted (immunity_code/requalify_code) and barred-player-granted (bar_leader/
// grant_immunity, see server/barredInfluence.ts). The server matches the submission
// against whichever entry in game.activeCodes it corresponds to and checks the
// submitter's eligibility; every failure path (no match, ineligible, immune target, etc.)
// returns the same generic invalid-code shape so nothing about which codes exist, who
// owns them, or what type they are ever leaks to an ineligible submitter.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const { code } = req.query
  const { playerId, code: submittedCode } = req.body as RedeemCodeSubmission

  if (!playerId || !submittedCode) {
    return res.status(400).json({ error: 'Missing playerId or code' })
  }

  const game = await findGameByCode(code as string)
  if (!game) {
    return res.status(404).json({ error: 'Game not found' })
  }

  if (game.status !== 'campaign') {
    return res.status(400).json({ error: 'Codes can only be redeemed during the campaign phase' })
  }

  const player = game.players.find(p => p.id === playerId)
  if (!player) {
    return res.status(404).json({ error: 'Player not found' })
  }

  if (!Array.isArray(game.activeCodes)) game.activeCodes = []

  const normalized = submittedCode.trim().toUpperCase()
  const activeCode = game.activeCodes.find(c =>
    c.code === normalized
    && !c.consumed
    && (c.validForRound === undefined || c.validForRound === game.currentRound)
  )

  if (!activeCode) {
    return res.status(400).json(INVALID_CODE_ERROR)
  }

  if (player.id === activeCode.ownerId) {
    return res.status(403).json({ error: 'You cannot redeem your own code' })
  }

  if (!isEligible(activeCode.eligibility, player)) {
    return res.status(400).json(INVALID_CODE_ERROR)
  }

  // No code type is redeemable once the game is down to 4 or fewer qualified players — this
  // subsumes the narrower "don't let bar_leader drop the game below 2 qualified" guard that
  // used to live in the bar_leader branch below (4-or-fewer already covers 2-or-fewer), and
  // matches the same threshold assignBarredInfluence uses to stop granting new influences
  // (see server/barredInfluence.ts) and LeaderDecisionPanel uses to stop offering executive
  // decisions at all.
  const qualifiedCount = game.players.filter(p => p.isQualified).length
  if (qualifiedCount <= 4) {
    return res.status(400).json({ error: 'No codes are valid with 4 or fewer qualified players remaining.' })
  }

  const codeType = activeCode.type
  let message: string
  let consumeCode = true

  if (codeType === 'immunity') {
    // NOTE: unlike a decision-time grant, this code is only redeemable once currentRound
    // has already advanced to activeCode.validForRound (checked above) — i.e. we are
    // already IN the cycle whose decision phase this should protect against, so no further
    // +1 here (decision.ts compares immuneFromBarInRound === game.currentRound at that
    // later point, when currentRound is still unchanged from right now).
    player.immuneFromBarInRound = game.currentRound
    message = 'You have been granted immunity from being barred this cycle.'
  } else if (codeType === 'requalify') {
    // no-op (but NOT consumed, so an actually-barred player can still use it later this
    // cycle) if the redeemer is already qualified.
    if (!player.isQualified) {
      player.isQualified = true
      clearBarredInfluence(game, player) // requalify -> loses their barred influence, if any
      message = 'You are qualified again!'
    } else {
      message = 'You are already qualified — this code has no effect for you.'
      consumeCode = false
    }
  } else if (codeType === 'bar_leader') {
    // Eligibility already confirmed the submitter is the current leader — they are the one
    // being barred. Mirror the same immunity guard decision.ts/swap.ts apply before barring
    // anyone. The qualifiedCount <= 3 guard above already prevents this from ever dropping
    // the game below 2 qualified players (no dead-end states).
    if (player.immuneFromBarInRound === game.currentRound) {
      return res.status(400).json(INVALID_CODE_ERROR)
    }

    player.isQualified = false
    player.leader = false
    player.roundsBarred += 1
    player.votes = 0
    if (game.rounds[game.currentRound]) {
      game.rounds[game.currentRound].barred.push(player.id)
    }
    assignBarredInfluence(game, player)
    message = 'You entered a code and have been instantly barred.'
  } else {
    // grant_immunity
    player.immuneFromBarInRound = game.currentRound
    message = 'You have been granted immunity from being barred this round.'
  }

  if (consumeCode) {
    activeCode.consumed = true
    game.activeCodes = game.activeCodes.filter(c => c !== activeCode)
  }

  const resWithSocket = res as NextApiResponseWithSocket
  if (resWithSocket.socket?.server?.io) {
    emitRoleBasedGameUpdates(resWithSocket.socket.server.io, game)

    // Non-blocking host banner/toast — never gated behind the narration/reveal sequence
    // (unlike the primary announcement bar), since no identity is leaked beyond what the
    // reveal itself states (the leader's own identity, and the redeemer's name, are already
    // public). Covers every code effect that's otherwise visible on the host screen the
    // instant it lands (bar_leader/grant_immunity via the qualified/barred lists, immunity
    // via the "Immunity" label on CandidateListItem) — each needs an announced beat rather
    // than silently appearing.
    if (codeType === 'bar_leader') {
      resWithSocket.socket.server.io.to(`host-game-${code}`).emit('campaign-code-event', {
        type: 'bar_leader',
        playerName: player.name,
      })
    } else if (codeType === 'grant_immunity' || codeType === 'immunity') {
      resWithSocket.socket.server.io.to(`host-game-${code}`).emit('campaign-code-event', {
        type: codeType,
        playerName: player.name,
      })
    }
  }

  await persistGame(game)

  res.status(200).json({ success: true, type: codeType, message })
}
