import type { NextApiRequest, NextApiResponse } from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { Server as NetServer, Socket } from 'net'
import { games } from '../../../../server/gameStore'

interface SocketServer extends NetServer {
  io?: SocketIOServer
}

interface SocketWithIO extends Socket {
  server: SocketServer
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { code } = req.query
    const { name } = req.body

    const gameId = Object.keys(games).find(id => games[id].code === code as string)
    if (!gameId) {
      return res.status(404).json({ error: 'Game not found' })
    }

    const game = games[gameId]

    // Check if leaving player was admin
    const leavingPlayer = game.players.find(p => p.name === name)
    const wasAdmin = leavingPlayer?.isAdmin || false

    // Remove player by name
    game.players = game.players.filter(p => p.name !== name)

    // If admin left and there are still players, assign new admin
    if (wasAdmin && game.players.length > 0) {
      game.players[0].isAdmin = true
      
      // Notify the new admin
      const resWithSocket = res as NextApiResponseWithSocket
      if (resWithSocket.socket?.server?.io) {
        resWithSocket.socket.server.io.to(`player-${code}-${game.players[0].name}`).emit('player-status-update', game.players[0])
      }
    }

    // Broadcast updated game state to all connected clients watching this game
    const resWithSocket = res as NextApiResponseWithSocket
    if (resWithSocket.socket?.server?.io) {
      resWithSocket.socket.server.io.to(`game-${code}`).emit('game-state-update', {
        players: game.players,
        status: game.status
      })
    }

    res.status(200).json({ success: true, players: game.players })
  } else {
    res.status(405).end()
  }
}
