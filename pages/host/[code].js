import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import io from 'socket.io-client'
import Button from '../../components/Button'
import Blob from '../../components/Blob'

let socket = null

export default function HostPage() {
  const router = useRouter()
  const { code } = router.query
  const [players, setPlayers] = useState([])
  const [connected, setConnected] = useState(false)
  const subscribedRef = useRef(false)

  useEffect(() => {
    if (!code) return

    // Initialize socket connection once
    if (!socket) {
      socket = io()

      socket.on('connect', () => {
        setConnected(true)
      })

      socket.on('players-updated', (updatedPlayers) => {
        setPlayers(updatedPlayers)
      })

      socket.on('error', (message) => {
        console.error(message)
      })
    }

    // Subscribe to this game (only once per code)
    if (!subscribedRef.current && connected) {
      socket.emit('subscribe-to-game', code)
      subscribedRef.current = true
    }

    // Fetch initial game state
    fetch(`/api/games/${code}`)
      .then(res => res.json())
      .then(data => setPlayers(data.players))
      .catch(err => console.error(err))

    return () => {
      // Don't cleanup socket listeners - keep them for other pages
    }
  }, [code, connected])

  if (!code) return <div style={{ padding: 24 }}>Loading...</div>

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: '100vh',
      padding: 24
    }}>
      {/* Top Half - Blob and Code */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between', // top spacer, Blob, Code -> Blob centered between top and Code
        flex: 1,
        gap: 20,
        width: '100%'
      }}>
        <div style={{ height: 0 }} /> {/* spacer at the very top */}

        <Blob size={200}/>

        <div style={{
          fontSize: '2em',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          color: '#5A5A5A',
          marginBottom: 0
        }}>
          Code: {code}
        </div>
      </div>

      {/* Bottom Half - Players */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        gap: 24,
        width: '100%'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'center',
          maxWidth: 600
        }}>
          {players.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#5A5A5A' }}>
              No players have joined yet
            </p>
          ) : (
            players.map((p, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#5A5A5A',
                  color: '#FFFFFF',
                  fontWeight: '500'
                }}
              >
                {p.name}
              </div>
            ))
          )}
        </div>

        <Button onClick={() => router.push('/')}>Back to Home</Button>
        
        <div style={{
          fontSize: '0.75em',
          color: '#5A5A5A',
          marginTop: 8
        }}>
          Status: {connected ? '🟢 Connected' : '🔴 Connecting...'}
        </div>
      </div>
    </div>
  )
}
