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
  const [loading, setLoading] = useState(true)
  const [gameStatus, setGameStatus] = useState<string | null>(null)
  const [playerMessage, setPlayerMessage] = useState<string | null>(null)
  const [gameExists, setGameExists] = useState(true)
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [hasVoted, setHasVoted] = useState(false)
  const [isSubmittingVote, setIsSubmittingVote] = useState(false)
  const [barredPlayerName, setBarredPlayerName] = useState<string | null>(null)
  const [decisionSelection, setDecisionSelection] = useState<string | null>(null)
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false)

  useEffect(() => {
    if (!code) return

    // Verify the game exists
    fetch(`/api/game/${code}`)
      .then(res => {
        setGameExists(res.ok)
        setLoading(false)
      })
      .catch(() => {
        setGameExists(false)
        setLoading(false)
      })
  }, [code])

  useEffect(() => {
    if (!code || !name) return

    if (!socket) {
      socket = io()
    }

    // Single subscription for game state
    socket.emit('subscribe-to-game', code)

    // Subscribe to player-specific updates
    socket.emit('subscribe-to-player', { code, playerName: name })

    // Listen for game state updates
    socket.on('game-state-update', (data: { players: Player[], status: string, barredPlayerName?: string | null }) => {
      setGameStatus(data.status)
      setAllPlayers(data.players)
      setBarredPlayerName(data.barredPlayerName ?? null)
      
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
  }, [code, name])

  useEffect(() => {
    if (!gameStatus) return

    if (gameStatus === 'vote' && hasVoted) {
      setPlayerMessage(gameContent.vote.waitingMessage || null)
      return
    }

    if (gameStatus === 'announcement') {
      const message = gameContent.announcement.hostMessage.replace(
        '{PLAYER_NAME}',
        barredPlayerName || 'TBD'
      )
      setPlayerMessage(message)
      return
    }

    if (gameStatus === 'decision' && currentPlayer?.leader) {
      setPlayerMessage(gameContent.decision.leaderMessage || null)
      return
    }

    setPlayerMessage(gameContent[gameStatus]?.playerMessage || null)
  }, [gameStatus, hasVoted, currentPlayer?.leader, barredPlayerName])

  useEffect(() => {
    if (gameStatus !== 'decision') {
      setDecisionSelection(null)
      setDecisionError(null)
    }
  }, [gameStatus])

  const handleSubmitVote = async (votes: string[]) => {
    if (!code || !currentPlayer) return

    setIsSubmittingVote(true)
    try {
      const res = await fetch(`/api/game/${code}/vote`, {
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
    if (!code || !currentPlayer) return

    if (!decisionSelection) {
      setDecisionError('Select a player to bar from election')
      return
    }

    setIsSubmittingDecision(true)
    try {
      const res = await fetch(`/api/game/${code}/decision`, {
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
    if (code && name) {
      await fetch(`/api/game/${code}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
    }
    // Clear stored player info
    localStorage.removeItem('currentPlayer')
    router.push('/')
  }

  const handleStartGameClick = async () => {
    if (!code) return
    try {
      const res = await fetch(`/api/game/${code}/update`, {
        method: 'PATCH'
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
            code={code as string}
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
            {isAdmin && (
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
