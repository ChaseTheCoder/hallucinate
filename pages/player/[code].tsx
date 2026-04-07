import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import io, { Socket } from 'socket.io-client'
import Button from '../../components/Button'
import VotePanel from './components/VotePanel'
import { gameContent } from '../../content/content'
import { Player } from '../../types/types'

let socket: Socket | null = null

export default function PlayerPage() {
  const router = useRouter()
  const { code, name } = router.query
  const gameCode = Array.isArray(code) ? code[0] : code
  const [loading, setLoading] = useState(true)
  const [gameStatus, setGameStatus] = useState<string | null>(null)
  const [playerMessage, setPlayerMessage] = useState<string | null>(null)
  const [gameExists, setGameExists] = useState(true)
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [hasVoted, setHasVoted] = useState(false)
  const [isSubmittingVote, setIsSubmittingVote] = useState(false)
  const [decisionSelection, setDecisionSelection] = useState<string | null>(null)
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false)
  const [cycleTimeInput, setCycleTimeInput] = useState<string>('10')
  const [cycleTimeSet, setCycleTimeSet] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [electionCycleStartTime, setElectionCycleStartTime] = useState<number>(0)
  const [cycleTime, setCycleTime] = useState<number>(10)
  const [winnerId, setWinnerId] = useState<string | null>(null)

  useEffect(() => {
    if (!gameCode) return

    // Verify the game exists
    fetch(`/api/game/${gameCode}`)
      .then(res => {
        setGameExists(res.ok)
        setLoading(false)
      })
      .catch(() => {
        setGameExists(false)
        setLoading(false)
      })
  }, [gameCode])

  useEffect(() => {
    if (!gameCode || !name) return

    if (!socket) {
      socket = io()
    }

    // Single subscription for game state
    socket.emit('subscribe-to-game', gameCode)

    // Subscribe to player-specific updates
    socket.emit('subscribe-to-player', { code: gameCode, playerName: name })

    // Listen for game state updates
    socket.on('game-state-update', (data: { players: Player[], status: string, barredPlayerName?: string | null, electionCycleStartTime?: number, cycleTime?: number }) => {
      setGameStatus(data.status)
      setAllPlayers(data.players)
      if (data.electionCycleStartTime !== undefined) {
        setElectionCycleStartTime(data.electionCycleStartTime)
      }
      if (data.cycleTime !== undefined) {
        setCycleTime(data.cycleTime)
      }
      
      // Update current player info
      const updatedCurrentPlayer = data.players.find(p => p.name === name)
      if (updatedCurrentPlayer) {
        setCurrentPlayer(updatedCurrentPlayer)
        setHasVoted(updatedCurrentPlayer.hasVoted)
      }
    })

    // Listen for player status updates
    socket.on('player-status-update', (player: Player) => {
      setCurrentPlayer(player)
      setHasVoted(player.hasVoted)
    })

    // Listen for game deletion
    socket.on('game-deleted', () => {
      setGameExists(false)
    })

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.off('game-state-update')
        socket.off('player-status-update')
        socket.off('game-deleted')
      }
    }
  }, [gameCode, name])

  useEffect(() => {
    if (!gameStatus) return

    if (gameStatus === 'vote' && hasVoted) {
      setPlayerMessage(gameContent.vote.waitingMessage || null)
      return
    }

    if (gameStatus === 'decision' && currentPlayer?.leader) {
      setPlayerMessage(gameContent.decision.leaderMessage || null)
      return
    }

    let message = gameContent[gameStatus]?.playerMessage || null
    if (gameStatus === 'campaign' && timeRemaining) {
      message = `${message} Time remaining: ${timeRemaining}`
    }

    setPlayerMessage(message)
  }, [gameStatus, hasVoted, currentPlayer?.leader, timeRemaining])

  useEffect(() => {
    if (gameStatus !== 'decision') {
      setDecisionSelection(null)
      setDecisionError(null)
    }
  }, [gameStatus])

  // Countdown timer for campaign
  useEffect(() => {
    if (gameStatus !== 'campaign' || electionCycleStartTime === 0) {
      setTimeRemaining('')
      return
    }

    const updateTime = () => {
      const elapsed = Math.floor((Date.now() - electionCycleStartTime) / 1000)
      const remaining = Math.max(0, cycleTime - elapsed)
      const minutes = Math.floor(remaining / 60)
      const seconds = remaining % 60
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [gameStatus, electionCycleStartTime, cycleTime])

  const handleSubmitVote = async (votes: string[]) => {
    if (!gameCode || !currentPlayer) return

    setIsSubmittingVote(true)
    try {
      const res = await fetch(`/api/game/${gameCode}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voterId: currentPlayer.id,
          votes
        })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to submit vote')
      }

      setHasVoted(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit vote'
      alert(message)
    } finally {
      setIsSubmittingVote(false)
    }
  }

  const handleSubmitDecision = async () => {
    if (!gameCode || !currentPlayer) return

    if (!decisionSelection) {
      setDecisionError('Select a player to bar from election')
      return
    }

    setIsSubmittingDecision(true)
    try {
      const res = await fetch(`/api/game/${gameCode}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaderId: currentPlayer.id,
          barredId: decisionSelection
        })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to submit decision')
      }

      setDecisionSelection(null)
      setDecisionError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit decision'
      setDecisionError(message)
    } finally {
      setIsSubmittingDecision(false)
    }
  }

  async function handleLeaveGame() {
    // Remove player from game
    if (gameCode && name) {
      await fetch(`/api/game/${gameCode}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
    }
    // Clear stored player info
    localStorage.removeItem('currentPlayer')
    router.push('/')
  }

  async function handleEndGame() {
    if (!gameCode) return

    try {
      const res = await fetch(`/api/game/${gameCode}/delete`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || `Failed to end game (${res.status})`)
      }
      console.log('Game ended successfully')
      // Clear stored player info and redirect
      localStorage.removeItem('currentPlayer')
      router.push('/')
    } catch (error) {
      console.error('Error ending game:', error)
      alert('Failed to end game')
    }
  }

  const handleStartGameClick = async () => {
    if (!gameCode) return
    try {
      const body: any = {}
      if (gameStatus === 'join') {
        const seconds = parseInt(cycleTimeInput)
        if (isNaN(seconds) || seconds < 5 || seconds > 60) {
          alert('Please enter a valid number of seconds (5-60)')
          return
        }
        body.cycleTime = seconds
        setCycleTimeSet(true)
      }
      const res = await fetch(`/api/game/${gameCode}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to start game')
      }
    } catch (error) {
      console.error('Error starting game:', error)
      const message = error instanceof Error ? error.message : 'Failed to start game'
      alert(message)
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>
  }

  if (!gameExists) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: 24
        }}
      >
        <h2>Game Not Found</h2>
        <p>The game code you're looking for doesn't exist.</p>
        <Button onClick={() => router.push('/')}>Go Home</Button>
      </div>
    )
  }

  const isAdmin = currentPlayer?.isAdmin || false
  const isLeader = currentPlayer?.leader || false
  const qualifiedPlayers = allPlayers.filter(p => p.isQualified)
  const decisionCandidates = qualifiedPlayers.filter(p => !p.leader)

  const getWinnerInfo = (winnerId: string | null) => {
    const winner = allPlayers.find(p => p.id === winnerId)
    return {
      winner,
      winnerName: winner?.name || 'TBD',
      winnerPoints: winner?.votes || 0,
      loserPoints: allPlayers.filter(p => p.isQualified && p.id !== winnerId).reduce((max, p) => Math.max(max, p.votes), 0)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        padding: 24,
        gap: 32
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 24
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8
          }}
        >
          <div
            style={{
              fontSize: '2.5em',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              color: '#5A5A5A'
            }}
          >
            {name || 'Player'}
          </div>
          {isAdmin && (
            <span
              style={{
                fontSize: '0.8em',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#5A5A5A'
              }}
            >
              Admin
            </span>
          )}
        </div>
        <Button onClick={handleLeaveGame}>Leave Game</Button>
      </div>

      {/* Main Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1
        }}
      >
        {gameStatus === 'vote' && !hasVoted && currentPlayer && qualifiedPlayers.length > 0 ? (
          <VotePanel
            currentPlayer={currentPlayer}
            qualifiedPlayers={qualifiedPlayers}
            onVoteSubmit={handleSubmitVote}
            isSubmitting={isSubmittingVote}
            code={gameCode as string}
          />
        ) : gameStatus === 'decision' && isLeader ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              width: '100%',
              height: '100%'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ color: '#5A5A5A', margin: '0 0 8px 0' }}>Leader Decision</h2>
              <p style={{ color: '#999', margin: 0, fontSize: '0.9em' }}>
                {playerMessage || 'Choose a player to bar from election.'}
              </p>
            </div>

            {decisionError && (
              <div
                style={{
                  padding: 12,
                  backgroundColor: '#ffebee',
                  color: '#c62828',
                  borderRadius: 4,
                  fontSize: '0.9em',
                  textAlign: 'center'
                }}
              >
                {decisionError}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                flex: 1,
                overflowY: 'auto'
              }}
            >
              {decisionCandidates.map(player => (
                <button
                  key={player.id}
                  onClick={() => setDecisionSelection(player.id)}
                  style={{
                    padding: '16px 20px',
                    backgroundColor: decisionSelection === player.id ? '#2E7D32' : '#E0E0E0',
                    color: decisionSelection === player.id ? '#FFFFFF' : '#5A5A5A',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: '1em',
                    fontWeight: decisionSelection === player.id ? 'bold' : '500',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s ease',
                    textAlign: 'left'
                  }}
                >
                  <span>{player.name}</span>
                </button>
              ))}
            </div>

            <div
              style={{
                width: '100vw',
                marginLeft: 'calc(-50vw + 50%)',
                marginRight: 'calc(-50vw + 50%)',
                marginBottom: -24,
                padding: '16px 24px',
                borderTop: '1px solid #E0E0E0',
                backgroundColor: '#FFFFFF'
              }}
            >
              <Button
                onClick={handleSubmitDecision}
                disabled={!decisionSelection || isSubmittingDecision}
                style={{
                  width: '100%',
                  opacity: decisionSelection ? 1 : 0.5,
                  cursor: decisionSelection ? 'pointer' : 'not-allowed'
                }}
              >
                {isSubmittingDecision ? 'Submitting...' : 'Submit Decision'}
              </Button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1
            }}
          >
            <p style={{ color: '#5A5A5A', textAlign: 'center', margin: 0 }}>
              {playerMessage || 'null...'}
            </p>
            {isAdmin && gameStatus === 'join' && !cycleTimeSet && (
              <>
                <p
                  style={{
                    color: '#5A5A5A',
                    textAlign: 'center',
                    marginTop: 12
                  }}
                >
                  Set campaign time per round (seconds):
                </p>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={cycleTimeInput}
                  onChange={(e) => setCycleTimeInput(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '1em',
                    border: '1px solid #5A5A5A',
                    borderRadius: 4,
                    textAlign: 'center',
                    width: '100px'
                  }}
                />
                <Button 
                  onClick={handleStartGameClick} 
                  disabled={allPlayers.length < 4}
                  style={{ marginTop: 12 }}
                >
                  Start Game
                </Button>
                {allPlayers.length < 4 && (
                  <p style={{ 
                    color: '#E03E3E', 
                    textAlign: 'center', 
                    marginTop: 8, 
                    fontSize: '0.9em' 
                  }}>
                    Need at least 4 players to start ({allPlayers.length}/4)
                  </p>
                )}
              </>
            )}
            {isAdmin && gameStatus === 'final' && (
              <>
                <p
                  style={{
                    color: '#5A5A5A',
                    textAlign: 'center',
                    marginTop: 12,
                    paddingTop: 36
                  }}
                >
                  Game complete! End the game when ready.
                </p>
                <Button onClick={handleEndGame}>End Game</Button>
              </>
            )}
            {isAdmin && (gameStatus !== 'join' || cycleTimeSet) && gameStatus !== 'campaign' && gameStatus !== 'final' && (
              <>
                <p
                  style={{
                    color: '#5A5A5A',
                    textAlign: 'center',
                    marginTop: 12,
                    paddingTop: 36
                  }}
                >
                  {gameContent.join.hostAction}
                </p>
                <Button onClick={handleStartGameClick}>Next</Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
