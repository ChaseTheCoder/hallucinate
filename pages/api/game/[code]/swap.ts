import type { NextApiRequest, NextApiResponse } from 'next'
import { emitRoleBasedGameUpdates, findGameByCode, persistGame } from '../../../../server/gameStore'
import type { Server as SocketIOServer } from 'socket.io'
import type { Server as NetServer, Socket } from 'net'

interface SocketServer extends NetServer {
  io?: SocketIOServer
}

interface SocketWithIO extends Socket {
  server: SocketServer
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO
}

type SwapAction = 'activate' | 'resolve' | 'expire'

interface SwapSubmission {
  action: SwapAction
  playerId?: string // required for 'resolve' — must be the swap window's barredPlayerId
  targetId?: string // required for 'resolve' — the qualified player to bar in exchange
}

// 25 seconds, server-authoritative. The host calls 'activate' the instant its narration
// reaches the swap-window pause point (setting `deadline`), then either the targeted
// player calls 'resolve' before `deadline`, or the host calls 'expire' once its own local
// countdown reaches 0 — but 'resolve' independently re-checks `deadline` server-side so a
// late submission can never sneak through regardless of what any client believes.
const SWAP_WINDOW_MS = 25000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const { code } = req.query
  const { action, playerId, targetId } = req.body as SwapSubmission

  const game = await findGameByCode(code as string)
  if (!game) {
    return res.status(404).json({ error: 'Game not found' })
  }

  if (game.status !== 'announcement' || game.executiveDecision !== 'barred_swap_chance' || !game.swapWindow) {
    return res.status(400).json({ error: 'No active swap window for this game' })
  }

  const resWithSocket = res as NextApiResponseWithSocket
  const broadcastAndPersist = async () => {
    if (resWithSocket.socket?.server?.io) {
      emitRoleBasedGameUpdates(resWithSocket.socket.server.io, game)
    }
    await persistGame(game)
  }

  if (action === 'activate') {
    if (game.swapWindow.status !== 'pending') {
      // Idempotent — the host may re-fire this if its effect re-runs.
      return res.status(200).json({ success: true, swapWindow: game.swapWindow })
    }
    game.swapWindow.status = 'active'
    game.swapWindow.deadline = Date.now() + SWAP_WINDOW_MS
    await broadcastAndPersist()
    return res.status(200).json({ success: true, swapWindow: game.swapWindow })
  }

  if (action === 'resolve') {
    if (game.swapWindow.status !== 'active') {
      return res.status(400).json({ error: 'Swap window is not currently active' })
    }
    if (!playerId || playerId !== game.swapWindow.barredPlayerId) {
      return res.status(403).json({ error: 'Only the selected barred player may resolve this swap' })
    }
    if (!game.swapWindow.deadline || Date.now() > game.swapWindow.deadline) {
      game.swapWindow.status = 'expired'
      await broadcastAndPersist()
      return res.status(400).json({ error: 'Swap window has expired' })
    }
    if (!targetId) {
      return res.status(400).json({ error: 'targetId is required' })
    }

    const swapPlayer = game.players.find(p => p.id === game.swapWindow!.barredPlayerId)
    if (!swapPlayer) {
      return res.status(404).json({ error: 'Swap-eligible player not found' })
    }

    const target = game.players.find(p => p.id === targetId)
    if (!target) {
      return res.status(404).json({ error: 'Target player not found' })
    }
    if (!target.isQualified) {
      return res.status(400).json({ error: 'Target must be currently qualified' })
    }
    if (target.leader) {
      return res.status(400).json({ error: 'Cannot bar the current leader' })
    }
    if (target.immuneFromBarInRound === game.currentRound) {
      return res.status(400).json({ error: 'Target is immune from being barred this round' })
    }
    if (target.id === swapPlayer.id) {
      return res.status(400).json({ error: 'Invalid target' })
    }

    // Apply the swap
    swapPlayer.isQualified = true
    target.isQualified = false
    target.roundsBarred += 1
    target.votes = 0

    if (game.rounds[game.currentRound]) {
      game.rounds[game.currentRound].barred.push(target.id)
    }

    game.swapWindow.status = 'resolved'
    game.swapWindow.resultQualifiedTargetId = target.id

    await broadcastAndPersist()
    return res.status(200).json({ success: true, swapWindow: game.swapWindow })
  }

  if (action === 'expire') {
    if (game.swapWindow.status !== 'active') {
      // Idempotent — no-op if already resolved/expired, or not yet activated.
      return res.status(200).json({ success: true, swapWindow: game.swapWindow })
    }
    if (game.swapWindow.deadline && Date.now() < game.swapWindow.deadline) {
      return res.status(400).json({ error: 'Swap window has not yet expired' })
    }
    game.swapWindow.status = 'expired'
    await broadcastAndPersist()
    return res.status(200).json({ success: true, swapWindow: game.swapWindow })
  }

  return res.status(400).json({ error: 'Invalid action' })
}
