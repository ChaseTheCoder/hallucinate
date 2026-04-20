import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import io, { Socket } from 'socket.io-client'
import Lucin from '../../components/Lucin'
import Nav from '../../components/host/Nav'
import Right from '../../components/host/Right'
import { Game } from '../../types/types'
import { gameContent } from '../../content/content'

let socket: Socket | null = null

export default function HostPage() {
  const router = useRouter()
  const { code } = router.query
  const gameCode = Array.isArray(code) ? code[0] : code
  const [game, setGame] = useState<Game | null>(null)
  const [content, setContent] = useState<typeof gameContent[keyof typeof gameContent] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [didLoadAttempted, setDidLoadAttempted] = useState(false)
  const [connected, setConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected')
  const [socketError, setSocketError] = useState<string | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)
  const hasTransitionedRef = useRef(false)
  const [messageIndex, setMessageIndex] = useState(0)
  const [barredPlayerName, setBarredPlayerName] = useState<string | null>(null)
  const [leaderName, setLeaderName] = useState<string>('TBD')
  const [currentRound, setCurrentRound] = useState<number>(0)
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [qualifiedPlayers, setQualifiedPlayers] = useState<Game['players']>([])
  const [sortedBarredPlayers, setSortedBarredPlayers] = useState<Game['players']>([])
  const [voteProgress, setVoteProgress] = useState<string | null>(null)
  const [winnerName, setWinnerName] = useState<string>('TBD')
  const [winnerPoints, setWinnerPoints] = useState<number>(0)
  const [loserPoints, setLoserPoints] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [latestBarredName, setLatestBarredName] = useState<string | null>(null)
  const [currentHostMessage, setCurrentHostMessage] = useState<string>('Loading...')

  // socket connection and game state management
  useEffect(() => {
    if (!gameCode) return

    if (!socket) {
      socket = io()
    }

    const handleConnect = () => {
      console.log('Socket connected')
      setConnected(true)
      setConnectionStatus('connected')
      setSocketError(null)

      // Re-subscribe on every successful connect (initial + reconnect)
      socket?.emit('subscribe-to-game', gameCode)
      setIsSubscribed(true)
    }

    const handleDisconnect = () => {
      console.log('Socket disconnected')
      setConnected(false)
      setConnectionStatus(socket?.active ? 'reconnecting' : 'disconnected')
      setIsSubscribed(false)
    }

    const handleConnectError = (error: Error) => {
      console.error('Socket connect_error:', error)
      setSocketError(error?.message || 'Connection error')
      setConnectionStatus(socket?.active ? 'reconnecting' : 'disconnected')
    }

    const handleError = (message: unknown) => {
      console.error('Socket error:', message)
      setSocketError(typeof message === 'string' ? message : 'Socket error')
    }

    const handleGameStateUpdate = (data: Game) => {
      console.log('Game state update received:', data)
      setGame(data)

      if (data.currentBarredPlayerIds && data.currentBarredPlayerIds.length > 0) {
        const latestBarredId = data.currentBarredPlayerIds[data.currentBarredPlayerIds.length - 1]
        const barredPlayer = data.players.find(p => p.id === latestBarredId)
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

    if (socket.connected) {
      handleConnect()
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
    }
  }, [gameCode, router])

  // Fetch initial game state once; socket keeps it live afterward.
  useEffect(() => {
    if (!gameCode || game || didLoadAttempted) return

    setDidLoadAttempted(true)
    setLoadError(null)
    fetch(`/api/game/${gameCode}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) {
          const message = res.status === 404
            ? 'Game not found'
            : 'Failed to load game'
          throw new Error(message)
        }
        return res.json()
      })
      .then(data => {
        console.log('Fetched initial game data:', data)
        setLoadError(null)
        setGame(data)
      })
      .catch(err => {
        console.error('Error fetching game:', err)
        const message = err instanceof Error ? err.message : 'Unable to fetch game'
        setLoadError(message)
        if (message !== 'Game not found') {
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current)
          }
          retryTimeoutRef.current = setTimeout(() => {
            setDidLoadAttempted(false)
          }, 10000)
        }
      })

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [gameCode, game, didLoadAttempted])

  // Keep display values in state so UI updates immediately from live game updates.
  useEffect(() => {
    const nextPlayers = game?.players ?? []
    const nextQualifiedPlayers = nextPlayers.filter(p => p.isQualified)
    const nextBarredPlayers = nextPlayers.filter(p => !p.isQualified)
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

    let nextTimeRemaining = ''
    if (game?.status === 'campaign' && remainingSeconds > 0) {
      const minutes = Math.floor(remainingSeconds / 60)
      const seconds = remainingSeconds % 60
      nextTimeRemaining = `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    setLeaderName(nextLeaderName)
    setCurrentRound(game?.currentRound ?? 0)
    setTimeRemaining(nextTimeRemaining)
    setQualifiedPlayers(nextQualifiedPlayers)
    setSortedBarredPlayers(nextSortedBarredPlayers)
    setVoteProgress(nextVoteProgress)
    setWinnerName(nextWinnerName)
    setWinnerPoints(nextWinnerPoints)
    setLoserPoints(nextLoserPoints)
  }, [game, remainingSeconds])

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
          setConnectionStatus('reconnecting')
          socket.connect()
        }
        if (socket.connected && gameCode && !isSubscribed) {
          socket.emit('subscribe-to-game', gameCode)
          setIsSubscribed(true)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [gameCode, isSubscribed])

  // Update host messages based on game status
  useEffect(() => {
    if (game?.status) {
      const gameStatus = game.status as keyof typeof gameContent
      setContent(gameContent[gameStatus])
      setMessageIndex(0)
    }
  }, [game?.status])

  // Cycle through host messages with 4-second delays
  useEffect(() => {
    if (!Array.isArray(content?.hostMessage) || messageIndex >= content.hostMessage.length - 1) return

    const timeout = setTimeout(() => {
      setMessageIndex(prev => prev + 1)
    }, 4000)

    return () => clearTimeout(timeout)
  }, [content?.hostMessage, messageIndex])

  useEffect(() => {
    let nextMessage = loadError
      ? loadError
      : isLoading
        ? 'Loading...'
        : 'Waiting...'

    if (content?.hostMessage) {
      const messageText = Array.isArray(content.hostMessage)
        ? (content.hostMessage[messageIndex] || '')
        : content.hostMessage

      nextMessage = messageText
        .replace('{LEADER_NAME}', leaderName || 'TBD')
        .replace('{PLAYER_NAME}', latestBarredName || 'TBD')
        .replace('{TIME}', timeRemaining || 'TBD')
        .replace('{VOTE_PROGRESS}', voteProgress || '0/0')
        .replace('{WINNER_NAME}', winnerName)
        .replace('{WINNER_POINTS}', winnerPoints.toString())
        .replace('{LOSER_POINTS}', loserPoints.toString())
    }

    setCurrentHostMessage(nextMessage)
  }, [
    loadError,
    isLoading,
    content,
    messageIndex,
    leaderName,
    latestBarredName,
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
  }, [game?.status, game?.electionCycleStartTime, game?.cycleTime])

  // Reset transition flag when entering campaign
  useEffect(() => {
    if (game?.status === 'campaign') {
      hasTransitionedRef.current = false
    }
  }, [game?.status])

  const handleEndGame = async () => {
    if (!gameCode) return
    
    const confirmed = confirm('Are you sure you want to end this game?')
    if (!confirmed) return

    try {
      const hostAccessKey = typeof window !== 'undefined'
        ? window.sessionStorage.getItem('hostAccessKey') || ''
        : ''
      const res = await fetch(`/api/game/${gameCode}/delete`, {
        method: 'DELETE',
        headers: {
          'x-host-access-key': hostAccessKey
        }
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to end game')
      }
      router.push('/start')
    } catch (error) {
      console.error('Error ending game:', error)
      alert('Failed to end game')
    }
  }

  const handleTransition = async () => {
    if (!gameCode) return
    try {
      const hostAccessKey = typeof window !== 'undefined'
        ? window.sessionStorage.getItem('hostAccessKey') || ''
        : ''
      const res = await fetch(`/api/game/${gameCode}/update`, {
        method: 'PATCH',
        headers: {
          'x-host-access-key': hostAccessKey
        }
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to transition')
      }
    } catch (error) {
      console.error('Error transitioning:', error)
    }
  }

  if (!gameCode) return <div style={{ padding: 24 }}>Loading...</div>

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
          justifyContent: 'center',
          width: '70%',
          gap: 20,
          height: '100%',
          position: 'relative'
        }}>
          <Lucin height='40vh'/>
          <p style={{ textAlign: 'center', fontSize: '1.2em', maxWidth: '80%' }}>
            {currentHostMessage}
          </p>
          {game?.status === 'campaign' && remainingSeconds > 0 ? (
            <div style={{
              marginTop: 12,
              padding: '10px 16px',
              backgroundColor: '#F0F4FF',
              borderRadius: 8,
              color: '#1E3A8A',
              fontWeight: '600',
              fontSize: '1em'
            }}>
              Time remaining: {timeRemaining}
            </div>
          ) : null}
          {loadError ? (
            <p style={{ textAlign: 'center', color: '#E03E3E', marginTop: 12 }}>
              Please refresh or check the game code.
            </p>
          ) : null}
        </div>

        <Right
          qualifiedPlayers={qualifiedPlayers}
          sortedBarredPlayers={sortedBarredPlayers}
          gameStatus={game?.status}
        />
      </div>
    </div>
  )
}
