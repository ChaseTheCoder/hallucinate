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

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { code } = req.query

    // Find game
    const gameId = Object.keys(games).find(id => games[id].code === code as string)
    if (!gameId) {
      return res.status(404).json({ error: 'Game not found' })
    }

    const game = games[gameId]

    // Check game status - must be in 'results' status
    if (game.status !== 'results') {
      return res.status(400).json({ error: 'Game is not in results status' })
    }

    // Verify all players have voted
    const totalVoters = game.players.length
    const votesSubmitted = game.players.filter(p => p.hasVoted).length
    
    if (votesSubmitted < totalVoters) {
      return res.status(400).json({ 
        error: 'Not all votes are in yet',
        votesSubmitted,
        totalVoters
      })
    }

    // Determine the leader from qualified players
    const qualifiedPlayers = game.players.filter(p => p.isQualified)
    
    if (qualifiedPlayers.length === 0) {
      return res.status(400).json({ error: 'No qualified players available' })
    }

    // Sort by votes (descending)
    const sortedPlayers = [...qualifiedPlayers].sort((a, b) => b.votes - a.votes)
    const newLeader = sortedPlayers[0]

    // Update leader status for all players
    game.players.forEach(p => p.leader = false)
    newLeader.leader = true

    // Update round data
    if (game.rounds[game.currentRound]) {
      game.rounds[game.currentRound].leader = newLeader.id
    }

    // Broadcast complete game state with results
    const resWithSocket = res as NextApiResponseWithSocket
    if (resWithSocket.socket?.server?.io) {
      resWithSocket.socket.server.io.to(`game-${code}`).emit('game-state-update', {
        players: game.players,
        status: game.status
      })

      // Broadcast detailed results
      resWithSocket.socket.server.io.to(`game-${code}`).emit('election-results', {
        leader: {
          id: newLeader.id,
          name: newLeader.name,
          votes: newLeader.votes
        },
        standings: sortedPlayers.map(p => ({
          id: p.id,
          name: p.name,
          votes: p.votes,
          isLeader: p.id === newLeader.id
        }))
      })
    }

    res.status(200).json({ 
      success: true,
      leader: {
        id: newLeader.id,
        name: newLeader.name,
        votes: newLeader.votes
      },
      standings: sortedPlayers.map(p => ({
        id: p.id,
        name: p.name,
        votes: p.votes,
        isLeader: p.id === newLeader.id
      }))
    })
  } else {
    res.status(405).end()
  }
}