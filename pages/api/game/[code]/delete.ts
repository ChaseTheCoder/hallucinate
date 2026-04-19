import type { NextApiRequest, NextApiResponse } from 'next'
import { deletePersistedGame, findGameByCode } from '../../../../server/gameStore'
import type { Server as SocketIOServer } from 'socket.io'
import type { Server as NetServer, Socket } from 'net'
import { unregisterGameOwner } from '../../../../server/abuseGuard'

interface SocketServer extends NetServer {
  io?: SocketIOServer
}

interface SocketWithIO extends Socket {
  server: SocketServer
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'DELETE') {
    const { code } = req.query

    const game = await findGameByCode(code as string)
    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    await deletePersistedGame(game.code)
    unregisterGameOwner(game.code)

    // Broadcast to unified game room only (one emission instead of two)
    const resWithSocket = res as NextApiResponseWithSocket
    if (resWithSocket.socket?.server?.io) {
      resWithSocket.socket.server.io.to(`game-${code}`).emit('game-deleted', { code })
    }

    res.status(200).json({ success: true })
  } else {
    res.status(405).end()
  }
}