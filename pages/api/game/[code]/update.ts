import type { NextApiRequest, NextApiResponse } from 'next'
import { games } from '../../../../server/gameStore'
import type { Server as SocketIOServer } from 'socket.io'
import type { Server as NetServer, Socket } from 'net'
import { StatusTypes } from '../../../../types/types'

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
  if (req.method === 'PATCH') {
    const { code } = req.query

    const game = Object.values(games).find(g => g.code === code as string)
    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    const currentStatus = game.status
    let newStatus: StatusTypes | null = null

    // Count qualified players
    const qualifiedPlayerCount = game.players.filter(p => p.isQualified).length

    // State transitions
    if (currentStatus === 'join' && game.players.length >= 4) {
      newStatus = 'rules'
      // Qualify all players at start for testing
      game.players.forEach(p => p.isQualified = true)
    } else if (currentStatus === 'rules') {
      newStatus = 'campaign'
    } else if (currentStatus === 'campaign') {
      newStatus = 'vote'
    } else if (currentStatus === 'vote') {
      newStatus = 'results'
    } else if (currentStatus === 'results') {
      // Check if exactly 2 players are qualified
      if (qualifiedPlayerCount === 2) {
        newStatus = 'final'
      } else {
        newStatus = 'decision'
      }
    } else if (currentStatus === 'decision') {
      newStatus = 'announcement'
    } else if (currentStatus === 'announcement') {
      newStatus = 'campaign'
    }

    if (!newStatus) {
      let reason = 'Cannot transition from current status or conditions not met'
      if (currentStatus === 'join' && game.players.length < 4) {
        reason = 'Need at least 4 players to start'
      } else if (currentStatus === 'announcement' && qualifiedPlayerCount < 2) {
        reason = 'Need at least 2 qualified players to continue'
      }
      return res.status(400).json({ error: reason })
    }

    game.status = newStatus

    const latestBarredId = game.rounds[game.currentRound]?.barred?.slice(-1)[0]
    const barredPlayerName = latestBarredId
      ? game.players.find(p => p.id === latestBarredId)?.name
      : null

    // Broadcast complete game state to unified room (one emission)
    const resWithSocket = res as NextApiResponseWithSocket
    if (resWithSocket.socket?.server?.io) {
      resWithSocket.socket.server.io.to(`game-${code}`).emit('game-state-update', {
        players: game.players,
        status: newStatus,
        barredPlayerName
      })
    }

    res.status(200).json({ success: true, status: newStatus })
  } else {
    res.status(405).end()
  }
}
