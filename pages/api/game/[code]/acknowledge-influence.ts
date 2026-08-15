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

// Dismisses the announcement-phase "you were barred and granted an influence" Popover
// (see pages/player/[code].tsx / server-persisted PlayerProjection.influence). Deliberately
// NOT gated to any particular game.status — the popover must stay up (and be dismissable)
// across status changes, reconnects, and app reopens for as long as it's unacknowledged.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const { code } = req.query
  const { playerId } = req.body as { playerId: string }

  if (!playerId) {
    return res.status(400).json({ error: 'Missing playerId' })
  }

  const game = await findGameByCode(code as string)
  if (!game) {
    return res.status(404).json({ error: 'Game not found' })
  }

  const player = game.players.find(p => p.id === playerId)
  if (!player) {
    return res.status(404).json({ error: 'Player not found' })
  }

  if (!player.influence) {
    return res.status(400).json({ error: 'You have no influence to acknowledge' })
  }

  player.influenceAcknowledged = true

  const resWithSocket = res as NextApiResponseWithSocket
  if (resWithSocket.socket?.server?.io) {
    emitRoleBasedGameUpdates(resWithSocket.socket.server.io, game)
  }

  await persistGame(game)

  res.status(200).json({ success: true })
}
