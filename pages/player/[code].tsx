import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import io, { Socket } from 'socket.io-client'
import ButtonLiquid from '../../components/ButtonLiquid'
import VotePanel from '../../components/player/VotePanel'
import PlayerHeader from '../../components/player/PlayerHeader'
import LeaderDecisionPanel from '../../components/player/LeaderDecisionPanel'
import CampaignTimePanel from '../../components/player/CampaignTimePanel'
import Popover from '../../components/Popover'
import { gameContent } from '../../content/content'
import { ExecutiveDecisionType, PlayerProjection, StatusTypes } from '../../types/types'
import { submitVote } from '../../utils/player/submitVote'
import { leaveGame } from '../../utils/player/leaveGame'
import submitDecision from '../../utils/player/submitDecision'
import updateGame from '../../utils/updateGame'

let socket: Socket | null = null

interface SessionData {
  code: string
  playerId: string
  playerName: string
}

export default function PlayerPage() {
  const router = useRouter()
  const { code, name } = router.query
  const gameCode = Array.isArray(code) ? code[0] : code
  const playerName = Array.isArray(name) ? name[0] : name

  const [loading, setLoading] = useState(true)
  const [gameStatus, setGameStatus] = useState<StatusTypes | null>(null)
  const [playerMessage, setPlayerMessage] = useState<string | null>(null)
  const [gameExists, setGameExists] = useState(true)
  const [hasVoted, setHasVoted] = useState(false)
  const [isSubmittingVote, setIsSubmittingVote] = useState(false)
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false)
  const [cycleTimeInput, setCycleTimeInput] = useState<string>('300')
  const [cycleTimeSet, setCycleTimeSet] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected')
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [canVote, setCanVote] = useState(false)
  const [canDecide, setCanDecide] = useState(false)
  const [voteCandidates, setVoteCandidates] = useState<Array<{ id: string; name: string }>>([])
  const [decisionCandidates, setDecisionCandidates] = useState<Array<{ id: string; name: string }>>([])
  const [requiredVotes, setRequiredVotes] = useState(0)
  const [canStartGame, setCanStartGame] = useState(false)
  const [connectedPlayers, setConnectedPlayers] = useState(0)
  const [startBlockedReason, setStartBlockedReason] = useState<string | undefined>(undefined)
  const [showLeaveGamePopover, setShowLeaveGamePopover] = useState(false)
  const [showSkipRulesPopover, setShowSkipRulesPopover] = useState(false)

  const applyProjection = (projection: PlayerProjection) => {
    setGameStatus(projection.status)
    setHasVoted(projection.vote?.hasSubmitted ?? false)

    setCanVote(projection.actions.canVote)
    setCanDecide(projection.actions.canDecide)

    setVoteCandidates(projection.vote?.candidates ?? [])
    setRequiredVotes(projection.vote?.requiredVotes ?? 0)

    setDecisionCandidates(projection.decision?.candidates ?? [])

    setIsAdmin(Boolean(projection.admin))
    setCanStartGame(Boolean(projection.admin?.canStartGame))
    setConnectedPlayers(projection.admin?.connectedPlayers ?? 0)
    setStartBlockedReason(projection.admin?.startBlockedReason)

    setSessionData(prev => {
      const nextSession: SessionData = {
        code: projection.code,
        playerId: projection.session.playerId,
        playerName: projection.session.playerName,
      }
      if (
        prev
        && prev.code === nextSession.code
        && prev.playerId === nextSession.playerId
        && prev.playerName === nextSession.playerName
      ) {
        return prev
      }
      localStorage.setItem('playerSession', JSON.stringify(nextSession))
      return nextSession
    })
  }

  // Initialize session data from URL/localStorage and fetch player projection.
  useEffect(() => {
    if (!gameCode || !playerName) return

    const storedSessionRaw = localStorage.getItem('playerSession')
    let storedSession: SessionData | null = null
    if (storedSessionRaw) {
      try {
        const parsed = JSON.parse(storedSessionRaw)
        if (parsed?.code === gameCode && typeof parsed?.playerName === 'string' && typeof parsed?.playerId === 'string') {
          storedSession = parsed
        }
      } catch {
        storedSession = null
      }
    }

    const session: SessionData = storedSession ?? { code: gameCode, playerId: '', playerName }
    setSessionData(session)
    localStorage.setItem('playerSession', JSON.stringify(session))

    const identifierQuery = session.playerId
      ? `playerId=${encodeURIComponent(session.playerId)}`
      : `playerName=${encodeURIComponent(session.playerName)}`

    fetch(`/api/game/${gameCode}?role=player&${identifierQuery}`, { cache: 'no-store' })
      .then(async res => {
        if (!res.ok) {
          setGameExists(false)
          setLoading(false)
          return null
        }
        return res.json()
      })
      .then(data => {
        if (!data) return
        setGameExists(true)
        applyProjection(data as PlayerProjection)
        setLoading(false)
      })
      .catch(() => {
        setGameExists(false)
        setLoading(false)
      })
  }, [gameCode, playerName])

  // Establish and maintain socket connection with role-specific player projection updates.
  useEffect(() => {
    if (!gameCode || !sessionData) return

    if (!socket) {
      socket = io()
    }

    const establishConnection = () => {
      const payload = sessionData.playerId
        ? { code: gameCode, playerId: sessionData.playerId }
        : { code: gameCode, playerName: sessionData.playerName }
      socket?.emit('subscribe-to-player', payload)
    }

    const handleConnect = () => {
      setConnectionStatus('connected')
      establishConnection()
    }

    const handleDisconnect = () => {
      setConnectionStatus(socket?.active ? 'reconnecting' : 'disconnected')
    }

    const handleConnectError = () => {
      setConnectionStatus(socket?.active ? 'reconnecting' : 'disconnected')
    }

    const handleProjection = (data: PlayerProjection) => {
      applyProjection(data)
    }

    const handleGameDeleted = () => {
      setGameExists(false)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('player-projection-update', handleProjection)
    socket.on('game-deleted', handleGameDeleted)

    if (socket.connected) {
      handleConnect()
    }

    return () => {
      if (!socket) return
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('player-projection-update', handleProjection)
      socket.off('game-deleted', handleGameDeleted)
    }
  }, [gameCode, sessionData])

  // Re-subscribe after returning from background.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) return
      if (!socket || !sessionData) return

      if (!socket.connected) {
        socket.connect()
        return
      }

      const payload = sessionData.playerId
        ? { code: gameCode, playerId: sessionData.playerId }
        : { code: gameCode, playerName: sessionData.playerName }
      socket.emit('subscribe-to-player', payload)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [gameCode, sessionData])

  useEffect(() => {
    if (!gameStatus) return

    if (gameStatus === 'vote' && hasVoted) {
      setPlayerMessage(gameContent.vote.waitingMessage || null)
      return
    }

    if (gameStatus === 'decision' && canDecide) {
      setPlayerMessage(gameContent.decision.leaderMessage || null)
      return
    }

    setPlayerMessage(gameContent[gameStatus]?.playerMessage || null)
  }, [gameStatus, hasVoted, canDecide])

  useEffect(() => {
    if (gameStatus !== 'decision') {
      setDecisionError(null)
    }
  }, [gameStatus])

  const handleSubmitVote = async (votes: string[]) => {
    if (!gameCode || !sessionData?.playerId) return

    setIsSubmittingVote(true)
    try {
      await submitVote(gameCode, sessionData.playerId, votes)
      setHasVoted(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit vote'
      alert(message)
    } finally {
      setIsSubmittingVote(false)
    }
  }

  const handleSubmitDecision = async (barredId: string, ed: ExecutiveDecisionType, edTargetId?: string) => {
    if (!gameCode || !sessionData?.playerId) return
    setIsSubmittingDecision(true)
    setDecisionError(null)
    try {
      await submitDecision(gameCode, sessionData.playerId, barredId, ed, edTargetId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit decision'
      setDecisionError(message)
    } finally {
      setIsSubmittingDecision(false)
    }
  }

  const handleLeaveGameClick = () => {
    setShowLeaveGamePopover(true)
  }

  const confirmLeaveGame = async () => {
    if (gameCode && sessionData?.playerName) {
      await leaveGame(gameCode, sessionData.playerName)
    }
    localStorage.removeItem('playerSession')
    router.push('/')
  }

  const handleStartGameClick = async () => {
    if (!gameCode || !canStartGame) return

    try {
      const body: { cycleTime?: number } = {}
      if (gameStatus === 'join') {
        const seconds = parseInt(cycleTimeInput, 10)
        if (isNaN(seconds) || seconds < 5 || seconds > 60) {
          alert('Please enter a valid number of seconds (5-60)')
          return
        }
        body.cycleTime = seconds
      }

      await updateGame(gameCode, body)

      if (gameStatus === 'join') {
        setCycleTimeSet(true)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start game'
      alert(message)
    }
  }

  const handleSkipRulesClick = () => {
    setShowSkipRulesPopover(true)
  }

  const confirmSkipRules = async () => {
    if (!gameCode) return

    try {
      await updateGame(gameCode)
      setShowSkipRulesPopover(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to skip rules'
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
        <ButtonLiquid onClick={() => router.push('/')}>Go Home</ButtonLiquid>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        gap: 12
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          fontSize: '0.75em',
          padding: '6px 10px',
          borderRadius: 4,
          fontWeight: 500,
          backgroundColor: connectionStatus === 'connected' ? '#e8f5e9' : connectionStatus === 'reconnecting' ? '#fff8e1' : '#ffebee',
          color: connectionStatus === 'connected' ? '#2e7d32' : connectionStatus === 'reconnecting' ? '#f57f17' : '#c62828',
          zIndex: 1000
        }}
      >
        <span style={{ display: 'inline-block', width: 6, height: 6, backgroundColor: 'currentColor', borderRadius: '50%', marginRight: 6 }}></span>
        {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
      </div>

      <PlayerHeader
        playerName={sessionData?.playerName || playerName}
        isAdmin={isAdmin}
        onLeaveGame={handleLeaveGameClick}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1
        }}
      >
        {canVote && voteCandidates.length > 0 ? (
          <VotePanel
            candidates={voteCandidates}
            requiredVotes={requiredVotes}
            onVoteSubmit={handleSubmitVote}
            isSubmitting={isSubmittingVote}
          />
        ) : canDecide ? (
          <LeaderDecisionPanel
            decisionError={decisionError}
            decisionCandidates={decisionCandidates}
            isSubmittingDecision={isSubmittingDecision}
            onSubmitFinalDecision={handleSubmitDecision}
          />
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
              {playerMessage || 'Waiting...'}
            </p>
            {isAdmin && gameStatus === 'join' && !cycleTimeSet && (
              <CampaignTimePanel
                cycleTimeInput={cycleTimeInput}
                onCycleTimeChange={setCycleTimeInput}
                onStartGame={handleStartGameClick}
                playerCount={connectedPlayers}
                canStartGame={canStartGame}
                startBlockedReason={startBlockedReason}
              />
            )}

            {isAdmin && gameStatus === 'rules' && (
              <div style={{ marginTop: 16 }}>
                <ButtonLiquid onClick={handleSkipRulesClick}>
                  Skip Rules
                </ButtonLiquid>
              </div>
            )}
          </div>
        )}
      </div>

      <Popover
        isOpen={showLeaveGamePopover}
        onClose={() => setShowLeaveGamePopover(false)}
        title="Are you sure you want to leave this game?"
        confirmText="Confirm Leave Game"
        onConfirm={confirmLeaveGame}
      />

      <Popover
        isOpen={showSkipRulesPopover}
        onClose={() => setShowSkipRulesPopover(false)}
        title="Confirm Skip Rules"
        confirmText="Skip Rules"
        onConfirm={confirmSkipRules}
      />
    </div>
  )
}
