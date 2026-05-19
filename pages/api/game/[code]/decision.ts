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
  execDecisionTargetId?: string // Required when executiveDecision === 'bar_another'
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

  if (!['bar_another', 'self_immunity_next_cycle', 'grant_immunity_next_cycle', 'opt_out'].includes(executiveDecision)) {
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

  // Handle ED1: bar a second qualified player
  let ed1BarredPlayer: typeof game.players[0] | null = null
  if (executiveDecision === 'bar_another') {
    if (!execDecisionTargetId) {
      return res.status(400).json({ error: 'execDecisionTargetId required for bar_another' })
    }

    const edTarget = game.players.find(p => p.id === execDecisionTargetId)
    if (!edTarget) {
      return res.status(404).json({ error: 'Executive decision target player not found' })
    }
    if (!edTarget.isQualified) {
      return res.status(400).json({ error: 'Executive decision target is already barred' })
    }
    if (edTarget.immuneFromBarInRound === game.currentRound) {
      return res.status(400).json({ error: 'Executive decision target is immune this round' })
    }
    if (edTarget.id === leader.id) {
      return res.status(400).json({ error: 'Leader cannot bar themselves via executive decision' })
    }
    if (edTarget.id === barredPlayer.id) {
      return res.status(400).json({ error: 'Cannot bar the same player twice' })
    }

    edTarget.isQualified = false
    edTarget.roundsBarred += 1
    edTarget.votes = 0

    if (game.rounds[game.currentRound]) {
      game.rounds[game.currentRound].barred.push(edTarget.id)
    }

    game.executiveDecisionTargetId = edTarget.id
    ed1BarredPlayer = edTarget
  }

  // Handle ED2: grant the current leader immunity for next cycle's decision round.
  if (executiveDecision === 'self_immunity_next_cycle') {
    leader.immuneFromBarInRound = game.currentRound + 1
  }

  // Handle ED3: grant another qualified player immunity for next cycle's decision round.
  let immunityGrantedPlayer: typeof game.players[0] | null = null
  if (executiveDecision === 'grant_immunity_next_cycle') {
    if (!execDecisionTargetId) {
      return res.status(400).json({ error: 'execDecisionTargetId required for grant_immunity_next_cycle' })
    }

    const immunityTarget = game.players.find(p => p.id === execDecisionTargetId)
    if (!immunityTarget) {
      return res.status(404).json({ error: 'Immunity target player not found' })
    }
    if (immunityTarget.id === leader.id) {
      return res.status(400).json({ error: 'Leader cannot grant fellow immunity to themselves' })
    }
    if (!immunityTarget.isQualified) {
      return res.status(400).json({ error: 'Immunity target must be currently qualified' })
    }

    immunityTarget.immuneFromBarInRound = game.currentRound + 1
    game.executiveDecisionTargetId = immunityTarget.id
    immunityGrantedPlayer = immunityTarget
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
    ...(ed1BarredPlayer !== null ? {
      ed1Barred: {
        id: ed1BarredPlayer.id,
        name: ed1BarredPlayer.name
      }
    } : {}),
    ...(immunityGrantedPlayer !== null ? {
      immunityGranted: {
        id: immunityGrantedPlayer.id,
        name: immunityGrantedPlayer.name
      }
    } : {})
  })
}
