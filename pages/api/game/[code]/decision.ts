import type { NextApiRequest, NextApiResponse } from 'next'
import { emitRoleBasedGameUpdates, findGameByCode, persistGame } from '../../../../server/gameStore'
import type { Server as SocketIOServer } from 'socket.io'
import type { Server as NetServer, Socket } from 'net'
import type { ExecutiveDecisionType } from '../../../../types/types'

interface SocketServer extends NetServer {
  io?: SocketIOServer
}

interface SocketWithIO extends Socket {
  server: SocketServer
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO
}

interface DecisionSubmission {
  leaderId: string
  barredId: string
  executiveDecision: ExecutiveDecisionType
  execDecisionTargetId?: string // Required only for barred_swap_chance (the previously-barred player selected)
}

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function generateCode(len: number = 4): string {
  let s = ''
  for (let i = 0; i < len; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return s
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const { code } = req.query
  const { leaderId, barredId, executiveDecision, execDecisionTargetId } = req.body as DecisionSubmission

  if (!leaderId || !barredId || !executiveDecision) {
    return res.status(400).json({ error: 'Missing leaderId, barredId, or executiveDecision' })
  }

  if (!['immunity_code', 'requalify_code', 'barred_swap_chance', 'opt_out'].includes(executiveDecision)) {
    return res.status(400).json({ error: 'Invalid executiveDecision value' })
  }

  const game = await findGameByCode(code as string)
  if (!game) {
    return res.status(404).json({ error: 'Game not found' })
  }

  if (game.status !== 'decision') {
    return res.status(400).json({ error: 'Game is not in decision status' })
  }

  const leader = game.players.find(p => p.id === leaderId)
  if (!leader || !leader.leader) {
    return res.status(403).json({ error: 'Only the leader can submit a decision' })
  }

  const barredPlayer = game.players.find(p => p.id === barredId)
  if (!barredPlayer) {
    return res.status(404).json({ error: 'Player not found' })
  }

  if (!barredPlayer.isQualified) {
    return res.status(400).json({ error: 'Player is already barred' })
  }

  if (barredPlayer.immuneFromBarInRound === game.currentRound) {
    return res.status(400).json({ error: 'Player is immune from being barred this round' })
  }

  if (barredPlayer.id === leader.id) {
    return res.status(400).json({ error: 'Leader cannot bar themselves' })
  }

  // Apply primary bar
  barredPlayer.isQualified = false
  barredPlayer.roundsBarred += 1
  barredPlayer.votes = 0

  if (game.rounds[game.currentRound]) {
    game.rounds[game.currentRound].barred.push(barredPlayer.id)
  }

  // Store executive decision
  game.executiveDecision = executiveDecision

  // immunity_code / requalify_code: generate a single-use 4-letter code redeemable during
  // the NEXT campaign phase. No leader-selected target — any eligible player who receives
  // the code out-of-band can redeem it. `validForRound` matches game.currentRound once the
  // announcement -> campaign transition increments it (see update.ts).
  if (executiveDecision === 'immunity_code' || executiveDecision === 'requalify_code') {
    game.activeCode = {
      code: generateCode(),
      type: executiveDecision === 'immunity_code' ? 'immunity' : 'requalify',
      ownerId: leader.id,
      validForRound: game.currentRound + 1,
    }
  }

  // barred_swap_chance: leader picks a PRE-EXISTING barred player (not the one just barred
  // above) to receive a 25s window, during the announcement reveal, to bar a qualified
  // player in their place and become qualified themselves.
  if (executiveDecision === 'barred_swap_chance') {
    if (!execDecisionTargetId) {
      return res.status(400).json({ error: 'execDecisionTargetId required for barred_swap_chance' })
    }

    const swapTarget = game.players.find(p => p.id === execDecisionTargetId)
    if (!swapTarget) {
      return res.status(404).json({ error: 'Swap candidate not found' })
    }
    // Must already be barred BEFORE this round's primary bar was applied above — exclude
    // the player just barred this round even though isQualified is now false for them too.
    if (swapTarget.isQualified || swapTarget.id === barredPlayer.id) {
      return res.status(400).json({ error: 'Swap candidate must be a player barred in a previous round' })
    }

    game.swapWindow = {
      barredPlayerId: swapTarget.id,
      status: 'pending',
    }
  }

  game.status = 'announcement'

  const resWithSocket = res as NextApiResponseWithSocket
  if (resWithSocket.socket?.server?.io) {
    emitRoleBasedGameUpdates(resWithSocket.socket.server.io, game)
  }

  await persistGame(game)

  res.status(200).json({
    success: true,
    status: game.status,
    executiveDecision,
    barred: {
      id: barredPlayer.id,
      name: barredPlayer.name
    },
  })
}
