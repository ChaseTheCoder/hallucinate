import type { NextApiRequest, NextApiResponse } from 'next'
import { games, enrichGame } from '../../../../server/gameStore'
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
    const { cycleTime } = req.body

    const game = Object.values(games).find(g => g.code === code as string)
    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    const currentStatus = game.status
    let newStatus: StatusTypes | null = null

    // Auto-transition if timer expired
    if (currentStatus === 'campaign' && game.electionCycleStartTime > 0) {
      const elapsed = Date.now() - game.electionCycleStartTime
      if (elapsed >= game.cycleTime * 1000) {
        newStatus = 'vote'
        console.log(`Campaign timer expired, auto-transitioning to vote`)
      }
    }

    // Count qualified players
    const qualifiedPlayerCount = game.players.filter(p => p.isQualified).length

    if (!newStatus) {

      // State transitions
      if (currentStatus === 'join' && game.players.length >= 4) {
        newStatus = 'rules'
        // Set cycle time if provided (in seconds)
        if (cycleTime && typeof cycleTime === 'number') {
          game.cycleTime = Math.min(60, Math.max(5, cycleTime)) // clamp seconds to 5-60
        }
        // Qualify all players at start for testing
        game.players.forEach(p => p.isQualified = true)
      } else if (currentStatus === 'rules') {
        newStatus = 'campaign'
      } else if (currentStatus === 'campaign') {
        newStatus = 'vote'
      } else if (currentStatus === 'vote') {
        if (qualifiedPlayerCount === 2) {
          newStatus = 'final' // Final announcement after final vote
        } else {
          newStatus = 'results'
        }
      } else if (currentStatus === 'results') {
        newStatus = 'decision'
      } else if (currentStatus === 'decision') {
        newStatus = 'announcement'
      } else if (currentStatus === 'announcement') {
        newStatus = 'campaign'
        game.players.forEach(p => {
          p.hasVoted = false
          p.votes = 0
        })
        game.currentRound += 1
      }
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

    // Set start time for campaign
    if (newStatus === 'campaign') {
      game.electionCycleStartTime = Date.now()
      // Use 5 seconds for final round (when only 2 qualified players remain)
      const campaignTime = qualifiedPlayerCount === 2 ? 5 : game.cycleTime
      console.log(`Campaign timer started for round ${game.currentRound}, time: ${campaignTime}s${qualifiedPlayerCount === 2 ? ' (final round)' : ''}`)
      
      // Broadcast the campaign time for this specific round
      const resWithSocket = res as NextApiResponseWithSocket
      if (resWithSocket.socket?.server?.io) {
        resWithSocket.socket.server.io.to(`game-${code}`).emit('game-state-update', enrichGame(game))
      }
      return res.status(200).json({ success: true, status: newStatus })
    }

    // Broadcast complete game state to unified room (one emission)
    const resWithSocket = res as NextApiResponseWithSocket
    if (resWithSocket.socket?.server?.io) {
      resWithSocket.socket.server.io.to(`game-${code}`).emit('game-state-update', enrichGame(game))
    }

    res.status(200).json({ success: true, status: newStatus })
  } else {
    res.status(405).end()
  }
}
