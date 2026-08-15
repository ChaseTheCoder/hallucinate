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

      // Ensure rounds array exists and is initialized
      if (!Array.isArray(game.rounds)) {
        game.rounds = []
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

    // One-time "barred candidate twist" round: candidates on the ballot are BARRED players
    // instead of qualified ones (see the trigger in update.ts's campaign -> vote
    // transition). Checked via activeTwistRound === currentRound, not a live qualified-count
    // check, since the winner's requalification below moves qualified count 3 -> 4 mid-round.
    const isTwistRound = game.activeTwistRound === game.currentRound

    // Validate that all voted players exist and are eligible candidates for this round —
    // barred players in the twist round, qualified players otherwise.
    votes.forEach(playerId => {
      const player = game.players.find(p => p.id === playerId)
      if (!player) {
        throw new Error(`Player with ID ${playerId} not found`)
      }
      if (isTwistRound) {
        if (player.isQualified) {
          throw new Error(`${player.name} is already qualified and is not on the ballot for this special election`)
        }
      } else if (!player.isQualified) {
        throw new Error(`${player.name} is not qualified to run for leader`)
      }
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

      // Mark voter as having voted and ensure they are marked as connected (handles reconnection)
      voter.hasVoted = true
      voter.isConnected = true

    // Record ballot as ranked player IDs for this round.
    game.rounds[game.currentRound].votes[voterId] = votes

    // Check if ALL CONNECTED players have voted
    const connectedPlayers = game.players.filter(p => p.isConnected)
    const connectedVoters = connectedPlayers.length
    const votesSubmitted = connectedPlayers.filter(p => p.hasVoted).length
    const allVotesIn = votesSubmitted >= connectedVoters

    const resWithSocket = res as NextApiResponseWithSocket

    if (allVotesIn) {
      const roundBallots = game.rounds[game.currentRound]?.votes ?? {}
      const roundVoteTotals: Record<string, number> = {}

      Object.values(roundBallots).forEach(ballot => {
        ballot.forEach((candidateId, index) => {
          const points = VOTE_POINTS[index] ?? 0
          if (!points) return
          roundVoteTotals[candidateId] = (roundVoteTotals[candidateId] ?? 0) + points
        })
      })

      // Scoring pool: barred players in the twist round, qualified players otherwise (see
      // isTwistRound above). Never confuse the two — a live qualified-count check would get
      // this wrong mid-resolution, since crowning the twist winner below flips their
      // isQualified to true.
      const scoringPool = isTwistRound
        ? game.players.filter(p => !p.isQualified)
        : game.players.filter(p => p.isQualified)

      // Apply round totals only once all connected players have voted.
      game.players.forEach(player => {
        const isCandidateThisRound = scoringPool.some(p => p.id === player.id)
        if (!isCandidateThisRound) {
          player.votes = 0
          return
        }
        player.votes = roundVoteTotals[player.id] ?? 0
      })

      // Transition to results or complete and compute leader/winner once all votes are in
      const sortedPlayers = [...scoringPool].sort((a, b) => b.votes - a.votes)
      const newLeader = sortedPlayers[0]

      if (isTwistRound) {
        // Barred candidate twist: the winner is drawn from the BARRED pool (scoringPool
        // above) rather than the qualified pool. Crowning them both requalifies
        // (isQualified = true) and makes them leader — they then go through the normal
        // mandatory decision-phase bar step like any other leader. This never routes to
        // 'final': the twist only ever fires at qualifiedPlayerCount === 3 (see update.ts),
        // never <= 2, so there's no ambiguity with the final-round shortcut below.
        game.status = 'results'
        game.players.forEach(p => {
          p.hasVoted = false // Reset for next phase
        })
        if (newLeader) {
          game.players.forEach(p => p.leader = false)
          newLeader.leader = true
          newLeader.isQualified = true // twist-round crowning also requalifies the winner
          if (game.rounds[game.currentRound]) {
            game.rounds[game.currentRound].leader = newLeader.id
          }
        }
      } else if (scoringPool.length <= 2) {
        // Final election - determine winner
        game.status = 'final'
        game.players.forEach(p => {
          p.leader = false
          p.hasVoted = false  // Reset for any subsequent phases
        })
        if (newLeader) {
          game.winner = newLeader.id
          newLeader.leader = true

          // Keep all qualified players visible so they can see final vote totals
          if (game.rounds[game.currentRound]) {
            game.rounds[game.currentRound].leader = newLeader.id
          }
        }
      } else {
        game.status = 'results'
        game.players.forEach(p => {
          p.hasVoted = false  // Reset for next phase
          if (!p.isQualified) {
            p.leader = false
          }
        })
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
        emitRoleBasedGameUpdates(resWithSocket.socket.server.io, game)

        if (game.status === 'final') {
          // Emit winner info for final election
          resWithSocket.socket.server.io.to(`host-game-${code}`).emit('game-complete', {
            winner: newLeader ? {
              id: newLeader.id,
              name: newLeader.name,
              votes: newLeader.votes
            } : null
          })
        } else {
          resWithSocket.socket.server.io.to(`host-game-${code}`).emit('election-results', {
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

      // Keep player UIs in sync after each individual vote submission.
      // This hides the vote panel immediately for voters who just submitted.
      emitRoleBasedGameUpdates(resWithSocket.socket.server.io, game)
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