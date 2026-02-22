import type { NextApiRequest, NextApiResponse } from 'next'
import { games } from '../../../../server/gameStore'
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

interface DecisionSubmission {
  leaderId: string
  barredId: string
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const { code } = req.query
  const { leaderId, barredId } = req.body as DecisionSubmission

  if (!leaderId || !barredId) {
    return res.status(400).json({ error: 'Missing leaderId or barredId' })
  }

  const gameId = Object.keys(games).find(id => games[id].code === code as string)
  if (!gameId) {
    return res.status(404).json({ error: 'Game not found' })
  }

  const game = games[gameId]

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

  if (barredPlayer.id === leader.id) {
    return res.status(400).json({ error: 'Leader cannot bar themselves' })
  }

  barredPlayer.isQualified = false
  barredPlayer.roundsBarred += 1

  if (game.rounds[game.currentRound]) {
    game.rounds[game.currentRound].barred.push(barredPlayer.id)
  }

  game.status = 'announcement'

  const resWithSocket = res as NextApiResponseWithSocket
  if (resWithSocket.socket?.server?.io) {
    resWithSocket.socket.server.io.to(`game-${code}`).emit('game-state-update', {
      players: game.players,
      status: game.status,
      barredPlayerName: barredPlayer.name
    })
  }

  res.status(200).json({
    success: true,
    status: game.status,
    barred: {
      id: barredPlayer.id,
      name: barredPlayer.name
    }
  })
}
