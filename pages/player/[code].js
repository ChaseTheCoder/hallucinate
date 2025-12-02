import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Button from '../../components/Button'

export default function PlayerPage() {
  const router = useRouter()
  const { code, name } = router.query
  const [loading, setLoading] = useState(true)
  const [gameExists, setGameExists] = useState(true)

  useEffect(() => {
    if (!code) return

    // Verify the game exists
    fetch(`/api/games/${code}`)
      .then(res => {
        setGameExists(res.ok)
        setLoading(false)
      })
      .catch(() => {
        setGameExists(false)
        setLoading(false)
      })
  }, [code])

  async function handleLeaveGame() {
    // Remove player from game
    if (code && name) {
      await fetch(`/api/games/${code}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
    }
    // Clear stored player info
    localStorage.removeItem('currentPlayer')
    router.push('/')
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>
  }

  if (!gameExists) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 24
      }}>
        <h2>Game Not Found</h2>
        <p>The game code you're looking for doesn't exist.</p>
        <Button onClick={() => router.push('/')}>Go Home</Button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      padding: 24,
      gap: 32
    }}>
      {/* Top - Name and Leave Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 24
      }}>
        <div style={{
          fontSize: '2.5em',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          color: '#5A5A5A'
        }}>
          {name || 'Player'}
        </div>
        <Button onClick={handleLeaveGame}>Leave Game</Button>
      </div>

      {/* Middle - Dynamic Content Area */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1
      }}>
        <p style={{ color: '#5A5A5A', textAlign: 'center', margin: 0 }}>
          Waiting for the game to start...
        </p>
      </div>
    </div>
  )
}
