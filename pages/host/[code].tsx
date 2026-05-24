import { useState, useEffect, useRef, useCallback } from 'react'
import Text from '../../components/Text'
import { useRouter } from 'next/router'
import io, { Socket } from 'socket.io-client'
import Lucin from '../../components/Lucin'
import Nav from '../../components/host/Nav'
import Right from '../../components/host/Right'
import Popover from '../../components/Popover'
import ButtonLiquid from '../../components/ButtonLiquid'
import { Game } from '../../types/types'
import { gameContent } from '../../content/content'
import { DEFAULT_HOST_PAUSE_MS, getHostNarrationSegment } from '../../content/hostNarration'
import updateGame from '../../utils/updateGame'
import useStatusMusic from '../../utils/host/useStatusMusic'
import { formatHostMessage, getExtendedAnnouncementHostMessages, shouldHostMessageBeBold } from '../../utils/host/utils'

let socket: Socket | null = null
const AUTO_TRANSITION_STATUSES: Game['status'][] = ['rules', 'results', 'announcement']

export default function HostPage() {
  const router = useRouter()
  const { code } = router.query
  const gameCode = Array.isArray(code) ? code[0] : code
  const [game, setGame] = useState<Game | null>(null)
  const [content, setContent] = useState<typeof gameContent[keyof typeof gameContent] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [gameExists, setGameExists] = useState(true)
  const [didLoadAttempted, setDidLoadAttempted] = useState(false)
  const [connected, setConnected] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [hasInitialGameData, setHasInitialGameData] = useState(false)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const socketInitializedRef = useRef(false)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)
  const hasTransitionedRef = useRef(false)
  const [messageIndex, setMessageIndex] = useState(0)
  const [barredPlayerName, setBarredPlayerName] = useState<string | null>(null)
  const [leaderName, setLeaderName] = useState<string>('TBD')
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [qualifiedPlayers, setQualifiedPlayers] = useState<Game['players']>([])
  const [sortedBarredPlayers, setSortedBarredPlayers] = useState<Game['players']>([])
  const [voteProgress, setVoteProgress] = useState<string | null>(null)
  const [winnerName, setWinnerName] = useState<string>('TBD')
  const [winnerPoints, setWinnerPoints] = useState<number>(0)
  const [loserPoints, setLoserPoints] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [latestBarredName, setLatestBarredName] = useState<string | null>(null)
  const [secondBarredName, setSecondBarredName] = useState<string | null>(null)
  const [grantedImmunityPlayerName, setGrantedImmunityPlayerName] = useState<string | null>(null)
  const [displayedHostMessages, setDisplayedHostMessages] = useState<string[]>(['Loading...'])
  const [displayedMessageIndices, setDisplayedMessageIndices] = useState<number[]>([0])
  const [isLeaderRevealed, setIsLeaderRevealed] = useState(false)
  const [isBarredRevealed, setIsBarredRevealed] = useState(false)
  const [isED1BarredRevealed, setIsED1BarredRevealed] = useState(false)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const [audioRetryTick, setAudioRetryTick] = useState(0)
  const [audioAmplitude, setAudioAmplitude] = useState<number>(0)
  const [isNarrationPlaying, setIsNarrationPlaying] = useState(false)
  const [showEndGamePopover, setShowEndGamePopover] = useState(false)
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const autoTransitionedStatusRef = useRef<Game['status'] | null>(null)

  const handleTransition = useCallback(async () => {
    if (!gameCode) return
    try {
      await updateGame(gameCode);
    } catch (error) {
      console.error('Error transitioning:', error)
    }
  }, [gameCode])

  useStatusMusic(game?.status, isNarrationPlaying)

  // socket connection and game state management
  useEffect(() => {
    if (!gameCode || !gameExists || !hasInitialGameData) return
    if (socketInitializedRef.current) return

    socketInitializedRef.current = true

    if (!socket) {
      socket = io()
    }

    const handleConnect = () => {
      console.log('Socket connected')
      setConnected(true)

      // Re-subscribe on every successful connect (initial + reconnect)
      socket?.emit('subscribe-to-host', gameCode)
      setIsSubscribed(true)
    }

    const handleDisconnect = () => {
      console.log('Socket disconnected')
      setConnected(false)
      setIsSubscribed(false)
    }

    const handleConnectError = (error: Error) => {
      console.error('Socket connect_error:', error)
      console.log(error?.message ?? 'Connection error: handleConnectError')
    }

    const handleError = (message: unknown) => {
      console.error('Socket error:', message)
      console.log(typeof message === 'string' ? message : 'Socket error: handleError')
    }

    const handleGameStateUpdate = (data: Game) => {
      console.log('Game state update received:', data)
      setGame(data)
      setLoadError(null)

      if (data.currentBarredPlayerIds && data.currentBarredPlayerIds.length > 0) {
        // Keep the primary barred player (leader's direct choice) for {PLAYER_NAME}.
        const primaryBarredId = data.currentBarredPlayerIds[0]
        const barredPlayer = data.players.find(p => p.id === primaryBarredId)
        setBarredPlayerName(barredPlayer?.name ?? null)
      } else {
        setBarredPlayerName(null)
      }
    }

    const handleGameComplete = (data: { winner: { id: string, name: string, votes: number } | null }) => {
      console.log('Game complete:', data)
      setGame(prev => {
        if (!prev) return null
        return {
          ...prev,
          winner: data.winner?.id || prev.winner
        }
      })
    }

    const handleGameDeleted = () => {
      console.log('Game deleted')
      socket?.disconnect()
      socket = null
      router.push('/')
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('error', handleError)
    socket.on('game-state-update', handleGameStateUpdate)
    socket.on('game-complete', handleGameComplete)
    socket.on('game-deleted', handleGameDeleted)

    // If socket is already connected (e.g., after page refresh), trigger handleConnect
    if (socket.connected) {
      console.log('[Socket] Already connected on mount, subscribing to game')
      handleConnect()
    } else {
      console.log('[Socket] Not connected on mount, waiting for connect event')
    }

    return () => {
      if (!socket) return
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('error', handleError)
      socket.off('game-state-update', handleGameStateUpdate)
      socket.off('game-complete', handleGameComplete)
      socket.off('game-deleted', handleGameDeleted)
      socketInitializedRef.current = false
    }
  }, [gameCode, gameExists, hasInitialGameData, router])

  useEffect(() => {
    if (!gameCode || game || didLoadAttempted) return

    console.log('[Host] Fetching initial game state for code:', gameCode)
    setDidLoadAttempted(true)
    setLoadError(null)
    fetch(`/api/game/${gameCode}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) {
          if (res.status === 404) {
            setGameExists(false)
            setIsLoading(false)
            return null
          }
          const message = 'Failed to load game'
          throw new Error(message)
        }
        return res.json()
      })
      .then(data => {
        if (!data) return
        console.log('Fetched initial game data:', data)
        setLoadError(null)
        setGameExists(true)
        setGame(data)
        setHasInitialGameData(true)
      })
      .catch(err => {
        console.error('Error fetching game:', err)
        const message = err instanceof Error ? err.message : 'Unable to fetch game'
        setLoadError(message)
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
        }
        retryTimeoutRef.current = setTimeout(() => {
          setDidLoadAttempted(false)
        }, 10000)
      })

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [gameCode, game, didLoadAttempted])

  // Reset initial data flag when game code changes
  useEffect(() => {
    setHasInitialGameData(false)
  }, [gameCode])

  useEffect(() => {
    const currentStatusContent = game?.status
      ? gameContent[game.status as keyof typeof gameContent]
      : null
    const hasLoadedCurrentStatusContent = Boolean(currentStatusContent && content === currentStatusContent)
    const hasReachedLastMessage = hasLoadedCurrentStatusContent
      && Array.isArray(content?.hostMessage)
      && messageIndex >= content.hostMessage.length - 1

    setIsLeaderRevealed(
      (game?.status === 'results' || game?.status === 'final') ? hasReachedLastMessage : true
    )

    // isBarredRevealed fires when the FIRST barred name message is reached.
    // For ED1, that is index (originalLength - 1); for standard announcement it is also the last message.
    const originalAnnouncementLength = gameContent.announcement.hostMessage.length
    const hasReachedFirstBarredMessage = hasLoadedCurrentStatusContent
      && Array.isArray(content?.hostMessage)
      && messageIndex >= originalAnnouncementLength - 1
    setIsBarredRevealed(
      game?.status === 'announcement' && hasReachedFirstBarredMessage
    )

    // isED1BarredRevealed fires when the extended ED1 sequence reaches the second barred name.
    setIsED1BarredRevealed(
      game?.status === 'announcement'
      && game?.executiveDecision === 'bar_another'
      && hasReachedLastMessage
    )
  }, [game?.status, game?.executiveDecision, content?.hostMessage, messageIndex])

  // Keep display values in state so UI updates immediately from live game updates.
  useEffect(() => {
    const nextPlayers = game?.players ?? []
    const currentRoundBarredIds = game?.currentBarredPlayerIds ?? game?.rounds?.[game?.currentRound ?? 0]?.barred ?? []
    const isAnnouncementStatus = game?.status === 'announcement'

    // Primary barred player: stays in qualified list until isBarredRevealed
    const primaryBarredId = game?.currentBarredPlayerIds?.[0] ?? null
    // ED1 secondary barred player: stays in qualified list until isED1BarredRevealed
    const ed1BarredId = game?.executiveDecision === 'bar_another' ? (game?.executiveDecisionTargetId ?? null) : null

    const isCurrentRoundBarredPlayer = (playerId: string) => currentRoundBarredIds.includes(playerId)
    const shouldHideAsBarred = (playerId: string): boolean => {
      if (!isAnnouncementStatus) return false
      if (playerId === primaryBarredId && !isBarredRevealed) return true
      if (playerId === ed1BarredId && !isED1BarredRevealed) return true
      return false
    }

    const nextQualifiedPlayers = nextPlayers.filter(p =>
      p.isQualified || (isCurrentRoundBarredPlayer(p.id) && shouldHideAsBarred(p.id))
    )
    const nextBarredPlayers = nextPlayers.filter(p =>
      !p.isQualified && !shouldHideAsBarred(p.id)
    )
    const nextSortedBarredPlayers = [...nextBarredPlayers].sort((a, b) => {
      const aRoundIndex = game?.rounds?.findIndex(round => round?.barred?.includes(a.id)) ?? -1
      const bRoundIndex = game?.rounds?.findIndex(round => round?.barred?.includes(b.id)) ?? -1
      if (aRoundIndex === -1 && bRoundIndex === -1) return 0
      return bRoundIndex - aRoundIndex
    })

    const nextWinner = game?.winner ? nextPlayers.find(p => p.id === game.winner) : null
    const nextWinnerName = nextWinner?.name || 'TBD'
    const nextWinnerPoints = nextWinner?.votes || 0
    const nextLoserPoints = nextPlayers
      .filter(p => p.isQualified && p.id !== game?.winner)
      .reduce((max, p) => Math.max(max, p.votes), 0)

    const nextLeaderName = nextPlayers.find(p => p.leader)?.name || 'TBD'
    const votedCount = nextQualifiedPlayers.filter(p => p.hasVoted).length
    const totalQualified = nextQualifiedPlayers.length
    const nextVoteProgress = game?.status === 'vote' ? `${votedCount}/${totalQualified}` : null

    // Derive second barred name for ED1 announcement
    const nextSecondBarred = ed1BarredId ? nextPlayers.find(p => p.id === ed1BarredId) : null
    setSecondBarredName(nextSecondBarred?.name ?? null)

    // Derive immunity target name for ED3 announcement
    const immunityTargetId = game?.executiveDecision === 'grant_immunity_next_cycle' ? (game?.executiveDecisionTargetId ?? null) : null
    const nextImmunityTarget = immunityTargetId ? nextPlayers.find(p => p.id === immunityTargetId) : null
    setGrantedImmunityPlayerName(nextImmunityTarget?.name ?? null)

    let nextTimeRemaining = ''
    if (game?.status === 'campaign' && remainingSeconds > 0) {
      const minutes = Math.floor(remainingSeconds / 60)
      const seconds = remainingSeconds % 60
      nextTimeRemaining = `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    setLeaderName(nextLeaderName)
    setTimeRemaining(nextTimeRemaining)
    setQualifiedPlayers(nextQualifiedPlayers)
    setSortedBarredPlayers(nextSortedBarredPlayers)
    setVoteProgress(nextVoteProgress)
    setWinnerName(nextWinnerName)
    setWinnerPoints(nextWinnerPoints)
    setLoserPoints(nextLoserPoints)
  }, [game, remainingSeconds, isBarredRevealed, isED1BarredRevealed])

  useEffect(() => {
    setIsLoading(!game)
  }, [game])

  useEffect(() => {
    setLatestBarredName(barredPlayerName)
  }, [barredPlayerName])

  // Keep host screen resilient against TV/browser sleep/wake cycles
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Host screen hidden, TV likely sleeping or backgrounded')
        return
      }

      console.log('Host screen visible again, checking socket status')
      if (socket) {
        if (!socket.connected) {
          console.log('reconnecting socket...')
          socket.connect()
        }
        if (socket.connected && gameCode && !isSubscribed) {
          socket.emit('subscribe-to-host', gameCode)
          setIsSubscribed(true)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [gameCode, isSubscribed])

  // Update host messages based on game status; extend announcement for ED1.
  useEffect(() => {
    if (game?.status) {
      const gameStatus = game.status as keyof typeof gameContent
      setContent(getExtendedAnnouncementHostMessages(gameStatus, game.executiveDecision))
      setMessageIndex(0)
    }
  }, [game?.status, game?.executiveDecision])

  // Play narration for each indexed host message and resolve after the segment delay.
  useEffect(() => {
    if (!game?.status || !Array.isArray(content?.hostMessage) || messageIndex >= content.hostMessage.length) return

    const segment = getHostNarrationSegment(game.status, messageIndex, game.executiveDecision)
    // For ED1 extended announcement messages (beyond original content.ts length),
    // segment will be null — apply dramatic pause for the second-to-last and last messages.
    let delayMs = segment?.pauseAfterMs ?? DEFAULT_HOST_PAUSE_MS
    if (
      game.status === 'announcement' &&
      game.executiveDecision === 'bar_another' &&
      !segment
    ) {
      const isLastMsg = messageIndex === content.hostMessage.length - 1
      const isSecondToLastMsg = messageIndex === content.hostMessage.length - 2
      if (isLastMsg || isSecondToLastMsg) delayMs = 8000
    }
    const isLastMessage = messageIndex >= content.hostMessage.length - 1
    const shouldAutoTransition = AUTO_TRANSITION_STATUSES.includes(game.status)

    let isCancelled = false
    let fallbackTimeout: ReturnType<typeof setTimeout> | null = null

    const resolveSegment = () => {
      fallbackTimeout = setTimeout(() => {
        if (isCancelled) return

        if (!isLastMessage) {
          setMessageIndex(prev => prev + 1)
          return
        }

        if (!shouldAutoTransition) return
        if (autoTransitionedStatusRef.current === game.status) return

        autoTransitionedStatusRef.current = game.status
        handleTransition()
      }, delayMs)
    }

    if (narrationAudioRef.current) {
      narrationAudioRef.current.pause()
      narrationAudioRef.current = null
    }

    if (!segment?.audioUrl || segment.hasDynamicTokens) {
      setIsNarrationPlaying(false)
      setAutoplayBlocked(false)
      resolveSegment()

      return () => {
        isCancelled = true
        if (fallbackTimeout) clearTimeout(fallbackTimeout)
      }
    }

    const audio = new Audio(segment.audioUrl)
    narrationAudioRef.current = audio
    audio.preload = 'auto'
    audio.crossOrigin = 'anonymous'
    setAutoplayBlocked(false)

    // Set up Web Audio API for volume analysis
    const setupAudioAnalysis = () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        }
        
        const audioContext = audioContextRef.current
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.6
        analyserRef.current = analyser

        const source = audioContext.createMediaElementSource(audio)
        source.connect(analyser)
        analyser.connect(audioContext.destination)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        
        const updateAmplitude = () => {
          if (isCancelled) return
          
          analyser.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
          // Moderate amplitude response with a power curve
          const normalizedAmplitude = Math.pow(average / 255, 0.85)
          setAudioAmplitude(normalizedAmplitude)
          
          animationFrameRef.current = requestAnimationFrame(updateAmplitude)
        }
        
        updateAmplitude()
      } catch (error) {
        console.warn('Audio analysis setup failed:', error)
      }
    }

    const handleEnded = () => {
      if (isCancelled) return
      setIsNarrationPlaying(false)
      setAudioAmplitude(0)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      resolveSegment()
    }

    const handleError = () => {
      if (isCancelled) return
      setIsNarrationPlaying(false)
      setAudioAmplitude(0)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      resolveSegment()
    }

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('canplay', setupAudioAnalysis, { once: true })

    audio.play().catch((error: unknown) => {
      const err = error as { name?: string }
      if (err?.name === 'NotAllowedError') {
        setIsNarrationPlaying(false)
        setAutoplayBlocked(true)
        console.log('Browser blocked autoplay. Audio will auto-retry on the next user interaction.')
        resolveSegment()
        return
      }
      handleError()
    })
    setIsNarrationPlaying(true)

    return () => {
      isCancelled = true
      audio.pause()
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      if (fallbackTimeout) clearTimeout(fallbackTimeout)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      setIsNarrationPlaying(false)
      setAudioAmplitude(0)
      if (narrationAudioRef.current === audio) {
        narrationAudioRef.current = null
      }
    }
  }, [game?.status, content?.hostMessage, messageIndex, audioRetryTick, handleTransition])

  useEffect(() => {
    if (!autoplayBlocked) return

    const retryPlayback = () => {
      setAutoplayBlocked(false)
      setAudioRetryTick(prev => prev + 1)
    }

    document.addEventListener('pointerdown', retryPlayback)
    document.addEventListener('keydown', retryPlayback)
    document.addEventListener('touchstart', retryPlayback)

    return () => {
      document.removeEventListener('pointerdown', retryPlayback)
      document.removeEventListener('keydown', retryPlayback)
      document.removeEventListener('touchstart', retryPlayback)
    }
  }, [autoplayBlocked])

  useEffect(() => {
    if (loadError) {
      setDisplayedHostMessages([loadError])
      setDisplayedMessageIndices([0])
      return
    }

    if (isLoading) {
      setDisplayedHostMessages(['Loading...'])
      setDisplayedMessageIndices([0])
      return
    }

    if (!content?.hostMessage) {
      setDisplayedHostMessages(['Waiting...'])
      setDisplayedMessageIndices([0])
      return
    }

    if (Array.isArray(content.hostMessage)) {
      // For 'rules' status, find the most recent "Phase" message and only show from there
      let startIndex = 0
      if (game?.status === 'rules') {
        for (let i = messageIndex; i >= 0; i--) {
          if (content.hostMessage[i]?.startsWith('Phase')) {
            startIndex = i
            break
          }
        }
      }

      // Build array of messages from startIndex to current messageIndex
      const messages = content.hostMessage.slice(startIndex, messageIndex + 1).map(msg => 
        msg
          .replace('{LEADER_NAME}', leaderName || 'TBD')
          .replace('{PLAYER_NAME}', latestBarredName || 'TBD')
          .replace('{ED1_PLAYER_NAME}', secondBarredName || 'TBD')
          .replace('{PLAYER_GRANTED_IMMUNITY}', grantedImmunityPlayerName || 'TBD')
          .replace('{TIME}', timeRemaining || 'TBD')
          .replace('{VOTE_PROGRESS}', voteProgress || '0/0')
          .replace('{WINNER_NAME}', winnerName)
          .replace('{WINNER_POINTS}', winnerPoints.toString())
          .replace('{LOSER_POINTS}', loserPoints.toString())
      )
      // Track original indices for each displayed message
      const indices = Array.from({ length: messageIndex - startIndex + 1 }, (_, i) => startIndex + i)
      setDisplayedHostMessages(messages)
      setDisplayedMessageIndices(indices)
    }
  }, [
    game?.status,
    loadError,
    isLoading,
    content,
    messageIndex,
    leaderName,
    latestBarredName,
    grantedImmunityPlayerName,
    timeRemaining,
    voteProgress,
    winnerName,
    winnerPoints,
    loserPoints
  ])

  // Update remaining seconds for campaign timer
  useEffect(() => {
    if (game?.status !== 'campaign' || !game.electionCycleStartTime || !game.cycleTime) {
      setRemainingSeconds(0)
      return
    }

    const updateRemaining = () => {
      const elapsed = Math.floor((Date.now() - game.electionCycleStartTime) / 1000)
      const remaining = Math.max(0, game.cycleTime - elapsed)
      setRemainingSeconds(remaining)
      if (remaining <= 0 && !hasTransitionedRef.current) {
        hasTransitionedRef.current = true
        console.log('Campaign timer expired, auto-transitioning to vote')
        handleTransition()
      }
    }

    updateRemaining()
    const interval = setInterval(updateRemaining, 1000)
    return () => clearInterval(interval)
  }, [game?.status, game?.electionCycleStartTime, game?.cycleTime, handleTransition])

  // Reset transition flags when phase changes
  useEffect(() => {
    if (game?.status === 'campaign') {
      hasTransitionedRef.current = false
    }

    autoTransitionedStatusRef.current = null
  }, [game?.status])

  const handleEndGame = () => {
    setShowEndGamePopover(true)
  }

  const confirmEndGame = async () => {
    if (!gameCode) return

    try {
      const res = await fetch(`/api/game/${gameCode}/delete`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to end game')
      }
      router.push('/start')
    } catch (error) {
      console.error('Error ending game:', error)
      alert('Failed to end game')
      setShowEndGamePopover(false)
    }
  }

  if (!gameCode) return <div style={{ padding: 24 }}>Loading...</div>

  if (!gameExists) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: 24,
          gap: 16
        }}
      >
        <h2 style={{ color: '#5A5A5A', margin: 0 }}>Game Not Found</h2>
        <p style={{ color: '#999', margin: 0 }}>The game code you're looking for doesn't exist.</p>
        <ButtonLiquid onClick={() => router.push('/start')}>Go to Start</ButtonLiquid>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      <Nav
        gameStatus={game?.status}
        code={gameCode}
        connected={connected}
        qualifiedPlayersCount={game?.players?.filter(player => player.isQualified).length}
        onEndGame={handleEndGame}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          height: '100%',
          marginTop: 24,
          flex: 1
        }}
      >
        {/* Left Half - Lucin and Info */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '70%',
          height: '100%',
          position: 'relative',
          paddingTop: '15%'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            height: '60%',
            aspectRatio: '1 / 1',
            zIndex: 0,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center'
          }}>
            <Lucin height='100%' amplitude={audioAmplitude}/>
          </div>
          <div style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 8,
            width: '80%'
          }}>
            {displayedHostMessages.map((message, index) => {
              const originalIndex = displayedMessageIndices[index] ?? index
              const isBold = shouldHostMessageBeBold(game?.status, message, originalIndex, game?.executiveDecision)
              return (
                <Text key={index} size={isBold ? 1.75 : 1.5} color='text-primary' bold={isBold} style={{ marginBottom: index < displayedHostMessages.length - 1 ? '0.5rem' : 0 }}>
                  {formatHostMessage(message, {
                    leaderName,
                    latestBarredName,
                    secondBarredName,
                    grantedImmunityPlayerName,
                    timeRemaining,
                    voteProgress,
                    winnerName,
                    winnerPoints,
                    loserPoints
                  })}
                </Text>
              )
            })}
            {loadError ? (
              <p style={{ textAlign: 'center', color: '#E03E3E', marginTop: 12 }}>
                Please refresh or check the game code.
              </p>
            ) : null}
          </div>
        </div>

        <Right
          qualifiedPlayers={qualifiedPlayers}
          sortedBarredPlayers={sortedBarredPlayers}
          gameStatus={game?.status}
          isLeaderRevealed={isLeaderRevealed}
        />
      </div>

      <Popover 
        isOpen={showEndGamePopover} 
        onClose={() => setShowEndGamePopover(false)}
        title="Are you sure you want to end this game?"
        confirmText="Confirm End Game"
        onConfirm={confirmEndGame}
      />
    </div>
  )
}
