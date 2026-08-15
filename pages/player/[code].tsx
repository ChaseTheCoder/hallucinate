import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import io, { Socket } from 'socket.io-client'
import ButtonLiquid from '../../components/ButtonLiquid'
import VotePanel from '../../components/player/VotePanel'
import PlayerHeader from '../../components/player/PlayerHeader'
import LeaderDecisionPanel from '../../components/player/LeaderDecisionPanel'
import CodeRedeemPanel from '../../components/player/CodeRedeemPanel'
import ActiveCodeDisplay from '../../components/player/ActiveCodeDisplay'
import SwapWindowPanel from '../../components/player/SwapWindowPanel'
import BottomNav, { PlayerTabId } from '../../components/player/BottomNav'
import InfluencePopover from '../../components/player/InfluencePopover'
import PostComposer from '../../components/player/PostComposer'
import Popover from '../../components/Popover'
import { gameContent } from '../../content/content'
import { ActiveCodeType, BarredInfluenceType, ExecutiveDecisionType, PhaseTypes, PlayerProjection, StatusTypes } from '../../types/types'
import { PHASE_DISPLAY_NAMES } from '../../config/phases'
import { submitVote } from '../../utils/player/submitVote'
import { leaveGame } from '../../utils/player/leaveGame'
import submitDecision from '../../utils/player/submitDecision'
import redeemCode from '../../utils/player/redeemCode'
import submitSwapChoice from '../../utils/player/submitSwapChoice'
import acknowledgeInfluence from '../../utils/player/acknowledgeInfluence'
import { setPostAlias, submitPost } from '../../utils/player/submitPost'
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
  const [gamePhase, setGamePhase] = useState<PhaseTypes | null>(null)
  const [playerMessage, setPlayerMessage] = useState<string | null>(null)
  const [gameExists, setGameExists] = useState(true)
  const [hasVoted, setHasVoted] = useState(false)
  const [isSubmittingVote, setIsSubmittingVote] = useState(false)
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected')
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [canVote, setCanVote] = useState(false)
  const [canDecide, setCanDecide] = useState(false)
  const [canResolveSwap, setCanResolveSwap] = useState(false)
  const [voteCandidates, setVoteCandidates] = useState<Array<{ id: string; name: string }>>([])
  const [decisionCandidates, setDecisionCandidates] = useState<Array<{ id: string; name: string }>>([])
  const [decisionBarredCandidates, setDecisionBarredCandidates] = useState<Array<{ id: string; name: string }>>([])
  const [requiredVotes, setRequiredVotes] = useState(0)
  const [canStartGame, setCanStartGame] = useState(false)
  const [connectedPlayers, setConnectedPlayers] = useState(0)
  const [startBlockedReason, setStartBlockedReason] = useState<string | undefined>(undefined)
  const [showLeaveGamePopover, setShowLeaveGamePopover] = useState(false)
  const [showSkipRulesPopover, setShowSkipRulesPopover] = useState(false)
  const [activeCode, setActiveCode] = useState<{ code: string; type: ActiveCodeType } | null>(null)
  const [redeemCodeError, setRedeemCodeError] = useState<string | null>(null)
  const [isRedeemingCode, setIsRedeemingCode] = useState(false)
  const [redeemCodeMessage, setRedeemCodeMessage] = useState<string | null>(null)
  const [swapWindowCandidates, setSwapWindowCandidates] = useState<Array<{ id: string; name: string }>>([])
  const [swapWindowDeadline, setSwapWindowDeadline] = useState<number>(0)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [isSubmittingSwap, setIsSubmittingSwap] = useState(false)
  const [activeTab, setActiveTab] = useState<PlayerTabId>('home')
  const [playerInfluence, setPlayerInfluence] = useState<{ type: BarredInfluenceType; acknowledged: boolean } | null>(null)
  // Once the influence popover is allowed to show for the *current* influence (see the
  // gameStatus === 'campaign' gate below), it must stay visible through any later status
  // change until acknowledged — e.g. a leader barred mid-campaign by a code sees the popover
  // immediately, and it must not vanish just because the game moves on to 'vote' before they
  // click "I Understand". Latched separately from playerInfluence.acknowledged so a brand new
  // influence (different type) re-applies the campaign-only gate fresh.
  const [influencePopoverUnlocked, setInfluencePopoverUnlocked] = useState(false)
  const latchedInfluenceTypeRef = useRef<BarredInfluenceType | null>(null)
  const [isAcknowledgingInfluence, setIsAcknowledgingInfluence] = useState(false)
  const [postInfo, setPostInfo] = useState<{ alias?: string; hasPostedThisCycle: boolean } | null>(null)
  const [isSettingAlias, setIsSettingAlias] = useState(false)
  const [isSubmittingPost, setIsSubmittingPost] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [qualifiedCount, setQualifiedCount] = useState<number>(0)

  const applyProjection = (projection: PlayerProjection) => {
    setGameStatus(projection.status)
    setGamePhase(projection.phase ?? null)
    setHasVoted(projection.vote?.hasSubmitted ?? false)

    setCanVote(projection.actions.canVote)
    setCanDecide(projection.actions.canDecide)
    setCanResolveSwap(projection.actions.canResolveSwap)

    setVoteCandidates(projection.vote?.candidates ?? [])
    setRequiredVotes(projection.vote?.requiredVotes ?? 0)

    setDecisionCandidates(projection.decision?.candidates ?? [])
    setDecisionBarredCandidates(projection.decision?.barredCandidates ?? [])

    setActiveCode(projection.activeCode ?? null)
    setSwapWindowCandidates(projection.swapWindow?.candidates ?? [])
    setSwapWindowDeadline(projection.swapWindow?.deadline ?? 0)

    setPlayerInfluence(projection.influence ?? null)
    setPostInfo(projection.post ?? null)
    setQualifiedCount(projection.qualifiedCount ?? 0)

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

  useEffect(() => {
    if (gameStatus !== 'campaign') {
      setRedeemCodeError(null)
      setRedeemCodeMessage(null)
    }
  }, [gameStatus])

  useEffect(() => {
    if (!canResolveSwap) {
      setSwapError(null)
    }
  }, [canResolveSwap])

  // Reset the latch whenever the influence itself changes (a fresh bar, or losing the old one
  // on requalify) so the campaign-only gate is re-applied for the new influence rather than
  // inheriting an already-unlocked popover from a prior one.
  useEffect(() => {
    if (playerInfluence?.type !== latchedInfluenceTypeRef.current) {
      latchedInfluenceTypeRef.current = playerInfluence?.type ?? null
      setInfluencePopoverUnlocked(false)
    }
  }, [playerInfluence?.type])

  // Once unacknowledged influence exists during a Campaign phase, permanently unlock the
  // popover for this influence — it then stays visible through any later status change
  // (vote/decision/announcement/etc.) until acknowledged, instead of disappearing the moment
  // gameStatus stops being 'campaign'.
  useEffect(() => {
    if (playerInfluence && !playerInfluence.acknowledged && gameStatus === 'campaign') {
      setInfluencePopoverUnlocked(true)
    }
  }, [playerInfluence, gameStatus])

  // If the Code/Post tab becomes disabled out from under the player (e.g. campaign phase
  // ends while they're on the Code tab), fall back to Home rather than stranding them on a
  // now-disabled tab.
  useEffect(() => {
    if (activeTab === 'code' && gameStatus !== 'campaign') {
      setActiveTab('home')
    }
    if (activeTab === 'post' && playerInfluence?.type !== 'post') {
      setActiveTab('home')
    }
  }, [activeTab, gameStatus, playerInfluence])

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

  const handleRedeemCode = async (submittedCode: string) => {
    if (!gameCode || !sessionData?.playerId) return
    setIsRedeemingCode(true)
    setRedeemCodeError(null)
    setRedeemCodeMessage(null)
    try {
      const result = await redeemCode(gameCode, sessionData.playerId, submittedCode)
      setRedeemCodeMessage(result?.message ?? 'Code accepted.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to redeem code'
      setRedeemCodeError(message)
    } finally {
      setIsRedeemingCode(false)
    }
  }

  const handleSubmitSwap = async (targetId: string) => {
    if (!gameCode || !sessionData?.playerId) return
    setIsSubmittingSwap(true)
    setSwapError(null)
    try {
      await submitSwapChoice(gameCode, sessionData.playerId, targetId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit swap choice'
      setSwapError(message)
    } finally {
      setIsSubmittingSwap(false)
    }
  }

  const handleAcknowledgeInfluence = async () => {
    if (!gameCode || !sessionData?.playerId) return
    setIsAcknowledgingInfluence(true)
    try {
      await acknowledgeInfluence(gameCode, sessionData.playerId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to dismiss'
      alert(message)
    } finally {
      setIsAcknowledgingInfluence(false)
    }
  }

  const handleConfirmAlias = async (alias: string) => {
    if (!gameCode || !sessionData?.playerId) return
    setIsSettingAlias(true)
    setPostError(null)
    try {
      await setPostAlias(gameCode, sessionData.playerId, alias)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to confirm name'
      setPostError(message)
    } finally {
      setIsSettingAlias(false)
    }
  }

  const handleSubmitPost = async (text: string) => {
    if (!gameCode || !sessionData?.playerId) return
    setIsSubmittingPost(true)
    setPostError(null)
    try {
      await submitPost(gameCode, sessionData.playerId, text)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit post'
      setPostError(message)
    } finally {
      setIsSubmittingPost(false)
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
      await updateGame(gameCode)
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

  const postTabEnabled = playerInfluence?.type === 'post'
  const codeTabEnabled = gameStatus === 'campaign'
  // Mirrors the server-side rule in pages/api/game/[code]/redeem-code.ts: no code type is
  // redeemable once 3 or fewer qualified players remain.
  const codesLocked = qualifiedCount <= 4
  // Gated to Campaign so a player's barred/influence reveal never shows up before the host's
  // announcement narration has finished — but once unlocked (see influencePopoverUnlocked
  // effects above) it stays sticky through any later status change, including across
  // reconnects, until acknowledged. It does NOT re-hide just because gameStatus later moves
  // past Campaign.
  const showInfluencePopover = Boolean(playerInfluence && !playerInfluence.acknowledged && influencePopoverUnlocked)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        gap: 12,
        paddingBottom: 88
      }}
    >
      {connectionStatus !== 'connected' && (
        <div
          style={{
            position: 'fixed',
            top: 12,
            right: 12,
            fontSize: '0.75em',
            padding: '6px 10px',
            borderRadius: 4,
            fontWeight: 500,
            backgroundColor: connectionStatus === 'reconnecting' ? '#fff8e1' : '#ffebee',
            color: connectionStatus === 'reconnecting' ? '#f57f17' : '#c62828',
            zIndex: 1000
          }}
        >
          <span style={{ display: 'inline-block', width: 6, height: 6, backgroundColor: 'currentColor', borderRadius: '50%', marginRight: 6 }}></span>
          {connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
        </div>
      )}

      <PlayerHeader
        playerName={sessionData?.playerName || playerName}
        isAdmin={isAdmin}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1
        }}
      >
        {activeTab === 'home' && (
          canVote && voteCandidates.length > 0 ? (
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
              decisionBarredCandidates={decisionBarredCandidates}
              isSubmittingDecision={isSubmittingDecision}
              onSubmitFinalDecision={handleSubmitDecision}
            />
          ) : canResolveSwap && swapWindowDeadline > 0 ? (
            <SwapWindowPanel
              candidates={swapWindowCandidates}
              deadline={swapWindowDeadline}
              isSubmitting={isSubmittingSwap}
              error={swapError}
              onSubmit={handleSubmitSwap}
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
              {gamePhase && (
                <p style={{ color: '#9A9A9A', textAlign: 'center', margin: '0 0 4px', fontSize: '0.75em', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {PHASE_DISPLAY_NAMES[gamePhase]}
                </p>
              )}
              <p style={{ color: '#5A5A5A', textAlign: 'center', margin: 0 }}>
                {playerMessage || 'Waiting...'}
              </p>
              {isAdmin && gameStatus === 'join' && (
                <ButtonLiquid
                  onClick={handleStartGameClick}
                  disabled={!canStartGame}
                  style={{ marginTop: 12 }}
                >
                  Start Game
                </ButtonLiquid>
              )}
              {isAdmin && gameStatus === 'join' && !canStartGame && startBlockedReason && (
                <p style={{ color: '#888', fontSize: '0.9em', marginTop: 8, textAlign: 'center' }}>
                  {startBlockedReason}
                </p>
              )}

              {isAdmin && gameStatus === 'rules' && (
                <div style={{ marginTop: 16 }}>
                  <ButtonLiquid onClick={handleSkipRulesClick}>
                    Skip Rules
                  </ButtonLiquid>
                </div>
              )}
            </div>
          )
        )}

        {activeTab === 'post' && postTabEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <PostComposer
              alias={postInfo?.alias}
              hasPostedThisCycle={Boolean(postInfo?.hasPostedThisCycle)}
              isCampaign={gameStatus === 'campaign'}
              onConfirmAlias={handleConfirmAlias}
              onSubmitPost={handleSubmitPost}
              isSubmittingAlias={isSettingAlias}
              isSubmittingPost={isSubmittingPost}
              error={postError}
            />
          </div>
        )}

        {activeTab === 'code' && codeTabEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            {/* Holding an active code and redeeming someone else's code are not mutually
                exclusive (e.g. a barred player holding a grant-immunity code could also be
                trying to redeem a leader-granted immunity code) — render both when applicable
                rather than either/or. */}
            {activeCode && <ActiveCodeDisplay code={activeCode.code} />}

            {codesLocked ? (
              <p style={{ color: '#999', fontSize: '0.85em', textAlign: 'center', margin: 0, fontStyle: 'italic' }}>
                No codes are valid with 4 or fewer qualified players remaining.
              </p>
            ) : (
              <>
                <CodeRedeemPanel
                  onSubmit={handleRedeemCode}
                  isSubmitting={isRedeemingCode}
                  error={redeemCodeError}
                />
                {redeemCodeMessage && (
                  <p style={{ color: '#5A5A5A', fontSize: '0.85em', marginTop: 8, textAlign: 'center' }}>
                    {redeemCodeMessage}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'leave' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <p style={{ color: '#5A5A5A', textAlign: 'center', margin: 0 }}>
              Ready to leave the game?
            </p>
            <ButtonLiquid onClick={handleLeaveGameClick}>Leave Game</ButtonLiquid>
          </div>
        )}
      </div>

      <BottomNav
        activeTab={activeTab}
        onSelect={setActiveTab}
        postEnabled={postTabEnabled}
        codeEnabled={codeTabEnabled}
      />

      <InfluencePopover
        isOpen={showInfluencePopover}
        influenceType={playerInfluence?.type ?? null}
        isSubmitting={isAcknowledgingInfluence}
        onAcknowledge={handleAcknowledgeInfluence}
      />

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
