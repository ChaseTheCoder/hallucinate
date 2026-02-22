import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import io, { Socket } from 'socket.io-client'
import Lucin from '../../components/Lucin'
import Button from '../../components/Button'
import { Game } from '../../types/types'
import { gameContent } from '../../content/content'

let socket: Socket | null = null

export default function HostPage() {
  const router = useRouter()
  const { code } = router.query
  const [game, setGame] = useState<Game | null>(null)
  const [content, setContent] = useState<typeof gameContent[keyof typeof gameContent] | null>(null)
  const [connected, setConnected] = useState(false)
  const listenersSetupRef = useRef(false)

  useEffect(() => {
    if (!code) return

    // Initialize socket connection once
    if (!socket) {
      socket = io()

      socket.on('connect', () => {
        console.log('Socket connected')
        setConnected(true)
      })

      socket.on('disconnect', () => {
        console.log('Socket disconnected')
        setConnected(false)
      })

      socket.on('error', (message) => {
        console.error('Socket error:', message)
      })
    }

    // Set up game-specific listeners only once
    if (!listenersSetupRef.current) {
      // Single listener for all game state updates
      socket.on('game-state-update', (data: { players: any[], status: string }) => {
        console.log('Game state update received:', data)
        setGame(prev => {
          if (!prev) return null
          return { 
            ...prev, 
            players: data.players, 
            status: data.status as any 
          }
        })
      })

      // Listen for game deletion
      socket.on('game-deleted', () => {
        console.log('Game deleted')
        socket?.disconnect()
        socket = null
        router.push('/')
      })

      listenersSetupRef.current = true
    }

    // Subscribe to game when connected
    if (connected && code) {
      console.log('Subscribing to game:', code)
      socket.emit('subscribe-to-game', code)
    }

    // Fetch initial game state
    if (!game && code) {
      fetch(`/api/game/${code}`, { cache: 'no-store' })
        .then(res => {
          if (!res.ok) throw new Error('Game not found')
          return res.json()
        })
        .then(data => {
          console.log('Fetched initial game data:', data)
          setGame(data)
        })
        .catch(err => {
          console.error('Error fetching game:', err)
          router.push('/')
        })
    }

    // Cleanup only on unmount
    return () => {
      if (socket && listenersSetupRef.current) {
        socket.off('game-state-update')
        socket.off('game-deleted')
        listenersSetupRef.current = false
      }
    }
  }, [code, connected, router, game])

  useEffect(() => {
    if (game?.status) {
      const gameStatus = game.status as keyof typeof gameContent
      setContent(gameContent[gameStatus])
    }
  }, [game?.status])

  const leaderName = game?.players.find(p => p.leader)?.name
  const latestBarredId = game?.rounds[game.currentRound]?.barred?.slice(-1)[0]
  const latestBarredName = latestBarredId
    ? game?.players.find(p => p.id === latestBarredId)?.name
    : null
  const hostMessage = content?.hostMessage
    ? content.hostMessage
        .replace('{LEADER_NAME}', leaderName || 'TBD')
        .replace('{PLAYER_NAME}', latestBarredName || 'TBD')
    : 'Waiting...'

  const handleEndGame = async () => {
    if (!code) return
    
    const confirmed = confirm('Are you sure you want to end this game?')
    if (!confirmed) return

    try {
      const res = await fetch(`/api/game/${code}/delete`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        throw new Error('Failed to end game')
      }
      console.log('Game ended successfully')
      // Router push handled by socket listener
    } catch (error) {
      console.error('Error ending game:', error)
      alert('Failed to end game')
    }
  }

  if (!code) return <div style={{ padding: 24 }}>Loading...</div>

  if (!game) return <div style={{ padding: 24 }}>Loading game...</div>

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          height: '100%',
          margin: 24,
          flex: 1
        }}
      >
        {/* Left Half - Lucin and Info */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          gap: 20,
          width: '100%',
          height: '100%',
          position: 'relative'
        }}>
          <Lucin height='40vh'/>
          <p style={{ textAlign: 'center', fontSize: '1.2em', maxWidth: '80%' }}>
            {hostMessage}
          </p>
        </div>

        {/* Right Half - Players */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flex: 1,
          gap: 24,
          width: '100%',
          height: '100%'
        }}>
          <h2 style={{ color: '#5A5A5A', margin: 0 }}>
            Candidates
          </h2>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              width: '100%',
              maxWidth: 400
            }}
          >
            {game.players.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#5A5A5A' }}>
                No players have joined yet
              </p>
            ) : (
              game.players.map((player, i) => (
                <div
                  key={player.id}
                  style={{
                    padding: '12px 20px',
                    backgroundColor: '#5A5A5A',
                    color: '#FFFFFF',
                    fontWeight: '500',
                    textAlign: 'center',
                    borderRadius: 4
                  }}
                >
                  {player.name}
                  {game.status === 'results' && ` (${player.votes} pts)`}
                  {player.isAdmin && ' (Admin)'}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: 0,
        right: 0,
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16
      }}>
        <span style={{ fontSize: 18, color: '#5A5A5A' }}>
          <strong>Code: {code}</strong>
        </span>
        <span style={{ color: '#5A5A5A' }}>|</span>
        <Button onClick={handleEndGame}>End Game</Button>
        <span style={{ color: '#5A5A5A' }}>|</span>
        <span style={{ fontSize: 18, color: '#5A5A5A' }}>
          Status: {game.status} {connected ? '🟢' : '🔴'}
        </span>
      </div>
    </div>
  )
}
