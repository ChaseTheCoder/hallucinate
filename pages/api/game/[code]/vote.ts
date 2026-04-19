import type { NextApiRequest, NextApiResponse } from 'next'
import { enrichGame, findGameByCode, persistGame } from '../../../../server/gameStore'
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
  votes: string[]      // Array of player IDs (1-3)
}

const VOTE_POINTS = [5, 3, 1] // Points for each position

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { code } = req.query
    const { voterId, votes } = req.body as VoteSubmission

    try {
      // Validation
      if (!voterId || !votes || !Array.isArray(votes) || votes.length < 1 || votes.length > 3) {
        return res.status(400).json({ 
          error: 'Invalid vote submission',
          details: 'Must provide voterId and array of 1-3 player IDs',
          recoveryAction: 'Please check your vote and try again'
        })
      }

      // Find game
      const game = await findGameByCode(code as string)
      if (!game) {
        return res.status(404).json({ 
          error: 'Game not found',
          details: 'The game code provided does not exist or has been deleted',
          recoveryAction: 'Check the game code and try joining again'
        })
      }

      // Check game status
      if (game.status !== 'vote' && game.status !== 'final') {
        return res.status(400).json({ 
          error: 'Voting is not currently active',
          details: `Current game status: ${game.status}. Voting is only allowed during 'vote' and 'final' phases.`,
          recoveryAction: 'Wait for the game to reach the voting phase'
        })
      }

      // Find voter
      const voter = game.players.find(p => p.id === voterId)
      if (!voter) {
        return res.status(404).json({ 
          error: 'Voter not found',
          details: 'Your player ID was not found in this game. You may have been disconnected.',
          recoveryAction: 'Rejoin the game with your player name'
        })
      }

      // Check if already voted (simple boolean check)
      if (voter.hasVoted) {
        return res.status(400).json({ 
          error: 'You have already voted in this round',
          details: 'Each player can only vote once per round',
          recoveryAction: 'Wait for the next round'
        })
      }

      // Validate that all three votes are for different players
      const uniqueVotes = new Set(votes)

      // Validate that voter didn't vote for themselves
      if (votes.includes(voterId)) {
        return res.status(400).json({ 
          error: 'Cannot vote for yourself',
          details: 'You must vote for other players',
          recoveryAction: 'Select different players and resubmit'
        })
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

      // Mark voter as having voted and ensure they are marked as connected (handles reconnection)
      voter.hasVoted = true
      voter.isConnected = true

    // Record votes in round data (for audit trail)
    game.rounds[game.currentRound].votes[voterId] = VOTE_POINTS

    // Check if ALL CONNECTED players have voted
    const connectedPlayers = game.players.filter(p => p.isConnected)
    const connectedVoters = connectedPlayers.length
    const votesSubmitted = connectedPlayers.filter(p => p.hasVoted).length
    const allVotesIn = votesSubmitted >= connectedVoters

    const resWithSocket = res as NextApiResponseWithSocket

    if (allVotesIn) {
      // Transition to results or complete and compute leader/winner once all votes are in
      const qualifiedPlayers = game.players.filter(p => p.isQualified)
      const sortedPlayers = [...qualifiedPlayers].sort((a, b) => b.votes - a.votes)
      const newLeader = sortedPlayers[0]

      if (qualifiedPlayers.length <= 2) {
        // Final election - determine winner
        game.status = 'final'
        if (newLeader) {
          game.winner = newLeader.id
        }
      } else {
        game.status = 'results'
        if (newLeader) {
          game.players.forEach(p => p.leader = false)
          newLeader.leader = true
          if (game.rounds[game.currentRound]) {
            game.rounds[game.currentRound].leader = newLeader.id
          }
        }
      }

      const latestBarredId = game.rounds[game.currentRound]?.barred?.slice(-1)[0]
      const barredPlayerName = latestBarredId
        ? game.players.find(p => p.id === latestBarredId)?.name
        : null

      if (resWithSocket.socket?.server?.io) {
        resWithSocket.socket.server.io.to(`game-${code}`).emit('game-state-update', enrichGame(game))

        if (game.status === 'final') {
          // Emit winner info for final election
          resWithSocket.socket.server.io.to(`game-${code}`).emit('game-complete', {
            winner: newLeader ? {
              id: newLeader.id,
              name: newLeader.name,
              votes: newLeader.votes
            } : null
          })
        } else {
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
      }
    } else if (resWithSocket.socket?.server?.io) {
      // Broadcast voting progress only (NO results or leader info)
      resWithSocket.socket.server.io.to(`game-${code}`).emit('vote-progress', {
        votesSubmitted,
        connectedVoters,
        allVotesIn
      })
    }

    await persistGame(game)

    res.status(200).json({
      success: true,
      votesSubmitted,
      connectedVoters,
      allVotesIn,
      status: game.status,
      message: allVotesIn ? 'All votes are in!' : 'Vote recorded successfully'
    })
    } catch (error: any) {
      console.error('Vote submission error:', error)
      return res.status(500).json({
        error: 'An error occurred while processing your vote',
        details: error?.message || 'Unknown error',
        recoveryAction: 'Please try voting again'
      })
    }
  } else {
    res.status(405).end()
  }
}