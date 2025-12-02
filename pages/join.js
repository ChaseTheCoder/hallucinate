import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Button from '../components/Button'

export default function Join() {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [gameData, setGameData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [storedPlayer, setStoredPlayer] = useState(null)
  const router = useRouter()

  // Load stored player info on mount
  useEffect(() => {
    const stored = localStorage.getItem('currentPlayer')
    if (stored) {
      const { code: storedCode, name: storedName } = JSON.parse(stored)
      setStoredPlayer({ code: storedCode, name: storedName })
    }
  }, [])

  function savePlayerToStorage(gameCode, playerName) {
    localStorage.setItem('currentPlayer', JSON.stringify({ code: gameCode, name: playerName }))
  }

  function clearPlayerFromStorage() {
    localStorage.removeItem('currentPlayer')
  }

  async function handleJoin(e) {
    e.preventDefault()
    setError('')
    if (!code || !name) return setError('Enter code and name')
    const res = await fetch(`/api/games/${code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    if (!res.ok) {
      const j = await res.json()
      setError(j.error || 'Failed to join')
      return
    }
    savePlayerToStorage(code, name)
    router.push(`/player/${code}?name=${encodeURIComponent(name)}`)
  }

  async function handleRejoin(playerName) {
    // Rejoin with existing player name
    const res = await fetch(`/api/games/${code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerName })
    })
    if (!res.ok) {
      setError('Failed to rejoin')
      return
    }
    savePlayerToStorage(code, playerName)
    router.push(`/player/${code}?name=${encodeURIComponent(playerName)}`)
  }

  async function handleCodeSubmit(e) {
    e.preventDefault()
    if (!code) {
      setError('Enter a code')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/games/${code}`)
      if (!res.ok) {
        setError('Game not found')
        setGameData(null)
      } else {
        const data = await res.json()
        setGameData(data)
      }
    } catch (err) {
      setError('Error loading game')
      setGameData(null)
    }
    setLoading(false)
  }

  return (
    <div style={{padding:24, maxWidth: 400, margin: '0 auto'}}>
      <h2>Join Game</h2>
      
      {/* Quick Rejoin If Stored */}
      {storedPlayer && (
        <div style={{marginBottom: 24, padding: 12, backgroundColor: '#f0f0f0', borderRadius: 8}}>
          <p style={{fontSize: '0.9em', color: '#666', margin: '0 0 8px 0'}}>
            Continue as <strong>{storedPlayer.name}</strong> in code <strong>{storedPlayer.code}</strong>?
          </p>
          <div style={{display: 'flex', gap: 8}}>
            <button
              onClick={() => handleRejoin(storedPlayer.name)}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: 'transparent',
                color: '#5A5A5A',
                border: '1px solid #5A5A5A',
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '0.9em'
              }}
            >
              Yes
            </button>
            <button
              onClick={() => clearPlayerFromStorage()}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: 'transparent',
                color: '#5A5A5A',
                border: '1px solid #5A5A5A',
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '0.9em'
              }}
            >
              No
            </button>
          </div>
          <hr style={{margin: '12px 0', border: 'none', borderTop: '1px solid #ddd'}} />
        </div>
      )}
      
      {/* Code Input - Always Show */}
      <div style={{display:'flex',flexDirection:'column',gap:8, marginBottom: 24, alignItems: 'center'}}>
        <div style={{width: '100%'}}>
          <label style={{display: 'block', marginBottom: 4, fontWeight: 500}}>Game Code</label>
          <input 
            placeholder="Enter 6-character code" 
            value={code} 
            onChange={e=>setCode(e.target.value.toUpperCase())}
            style={{width: '100%', padding: '10px', boxSizing: 'border-box', fontSize: '1.1em', fontFamily: 'monospace'}}
          />
        </div>
        <button
          onClick={handleCodeSubmit}
          style={{
            background: 'none',
            border: 'none',
            color: '#5A5A5A',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: '0.9em',
            fontFamily: 'Roboto, sans-serif',
            padding: 0
          }}
        >
          {loading ? 'Loading...' : 'Look Up Game'}
        </button>
      </div>

      {error && <div style={{color:'red', fontSize: '0.9em', marginBottom: 12}}>{error}</div>}

      {/* Show existing players if game found */}
      {gameData && gameData.players.length > 0 && (
        <div style={{marginBottom: 24}}>
          <p style={{fontWeight: 500, marginBottom: 12}}>Players in this game (click to rejoin):</p>
          <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            {gameData.players.map((p, i) => (
              <button
                key={i}
                onClick={() => handleRejoin(p.name)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'transparent',
                  color: '#5A5A5A',
                  border: '1px solid #5A5A5A',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '1em'
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
          <hr style={{margin: '24px 0', border: 'none', borderTop: '1px solid #ddd'}} />
        </div>
      )}

      {/* New Player Form */}
      <form onSubmit={handleJoin} style={{display:'flex',flexDirection:'column',gap:12}}>
        <p style={{fontSize: '0.9em', color: '#666', margin: '0 0 8px 0'}}>
          {gameData && gameData.players.length > 0 ? 'Or join with a new name:' : 'Join with a new name:'}
        </p>
        <div>
          <label style={{display: 'block', marginBottom: 4, fontWeight: 500}}>Your Name</label>
          <input 
            placeholder="Enter your display name" 
            value={name} 
            onChange={e=>setName(e.target.value)}
            style={{width: '100%', padding: '10px', boxSizing: 'border-box'}}
          />
        </div>
        <Button onClick={handleJoin}>Join Game</Button>
      </form>
    </div>
  )
}
