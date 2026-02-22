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

interface VoteSubmission {
  voterId: string      // Player ID of the voter
  votes: string[]      // Array of 3 player IDs [5pts, 3pts, 1pt]
}

const VOTE_POINTS = [5, 3, 1] // Points for each position

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { code } = req.query
    const { voterId, votes } = req.body as VoteSubmission

    // Validation
    if (!voterId || !votes || !Array.isArray(votes) || votes.length !== 3) {
      return res.status(400).json({ error: 'Invalid vote submission. Must provide voterId and array of 3 player IDs' })
    }

    // Find game
    const gameId = Object.keys(games).find(id => games[id].code === code as string)
    if (!gameId) {
      return res.status(404).json({ error: 'Game not found' })
    }

    const game = games[gameId]

    // Check game status
    if (game.status !== 'vote') {
      return res.status(400).json({ error: 'Voting is not currently active' })
    }

    // Find voter
    const voter = game.players.find(p => p.id === voterId)
    if (!voter) {
      return res.status(404).json({ error: 'Voter not found' })
    }

    // Check if already voted (simple boolean check)
    if (voter.hasVoted) {
      return res.status(400).json({ error: 'You have already voted in this round' })
    }

    // Validate that all three votes are for different players
    const uniqueVotes = new Set(votes)
    if (uniqueVotes.size !== 3) {
      return res.status(400).json({ error: 'Must vote for three different players' })
    }

    // Validate that voter didn't vote for themselves
    if (votes.includes(voterId)) {
      return res.status(400).json({ error: 'Cannot vote for yourself' })
    }

    // Validate that all voted players exist and are qualified to run for leader
    const votedPlayers = votes.map(playerId => {
      const player = game.players.find(p => p.id === playerId)
      if (!player) {
        throw new Error(`Player with ID ${playerId} not found`)
      }
      if (!player.isQualified) {
        throw new Error(`${player.name} is not qualified to run for leader`)
      }
      return player
    })

    // Initialize round if needed
    if (!game.rounds[game.currentRound]) {
      game.rounds[game.currentRound] = {
        roundNumber: game.currentRound,
        leader: '',
        barred: [],
        votes: {},
        roundStartTime: Date.now()
      }
    }

    // Add points to the voted players
    votedPlayers.forEach((player, index) => {
      player.votes += VOTE_POINTS[index]
    })

    // Mark voter as having voted
    voter.hasVoted = true

    // Record votes in round data (for audit trail)
    game.rounds[game.currentRound].votes[voterId] = VOTE_POINTS

    // Check if ALL players have voted
    const totalVoters = game.players.length
    const votesSubmitted = game.players.filter(p => p.hasVoted).length
    const allVotesIn = votesSubmitted >= totalVoters

    const resWithSocket = res as NextApiResponseWithSocket

    if (allVotesIn) {
      // Transition to results and compute leader once all votes are in
      game.status = 'results'
      const qualifiedPlayers = game.players.filter(p => p.isQualified)
      const sortedPlayers = [...qualifiedPlayers].sort((a, b) => b.votes - a.votes)
      const newLeader = sortedPlayers[0]

      if (newLeader) {
        game.players.forEach(p => p.leader = false)
        newLeader.leader = true
        if (game.rounds[game.currentRound]) {
          game.rounds[game.currentRound].leader = newLeader.id
        }
      }

      const latestBarredId = game.rounds[game.currentRound]?.barred?.slice(-1)[0]
      const barredPlayerName = latestBarredId
        ? game.players.find(p => p.id === latestBarredId)?.name
        : null

      if (resWithSocket.socket?.server?.io) {
        resWithSocket.socket.server.io.to(`game-${code}`).emit('game-state-update', {
          players: game.players,
          status: game.status,
          barredPlayerName
        })

        resWithSocket.socket.server.io.to(`game-${code}`).emit('election-results', {
          leader: newLeader ? {
            id: newLeader.id,
            name: newLeader.name,
            votes: newLeader.votes
          } : null,
          standings: sortedPlayers.map(p => ({
            id: p.id,
            name: p.name,
            votes: p.votes,
            isLeader: p.id === newLeader?.id
          }))
        })
      }
    } else if (resWithSocket.socket?.server?.io) {
      // Broadcast voting progress only (NO results or leader info)
      resWithSocket.socket.server.io.to(`game-${code}`).emit('vote-progress', {
        votesSubmitted,
        totalVoters,
        allVotesIn
      })
    }

    res.status(200).json({
      success: true,
      votesSubmitted,
      totalVoters,
      allVotesIn,
      status: game.status,
      message: allVotesIn ? 'All votes are in!' : 'Vote recorded successfully'
    })
  } else {
    res.status(405).end()
  }
}