import { useState } from 'react'
import { useRouter } from 'next/router'
import Lucin from '../components/Lucin'
import Button from '../components/Button'

export default function Start() {
  const [isCreating, setIsCreating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [hostAccessKey, setHostAccessKey] = useState('')
  const router = useRouter()

  async function handleStartGame() {
    setIsCreating(true)
    setErrorMessage('')

    try {
      const trimmedKey = hostAccessKey.trim()
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('hostAccessKey', trimmedKey)
      }

      const res = await fetch('/api/game', {
        method: 'POST',
        headers: {
          'x-host-access-key': trimmedKey
        }
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || `Failed to create game: ${res.statusText}`)
      }
      const game = await res.json()
      if (!game.code) {
        throw new Error('Invalid game response: missing code')
      }
      router.push(`/host/${game.code}`)
    } catch (error) {
      console.error(error)
      setErrorMessage(error instanceof Error ? error.message : 'Error creating game. Please try again.')
      setIsCreating(false)
    }
  }

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:20}}>
      <Lucin height="40%" />
      <h1>Hallucinate</h1>
      <div style={{display:'flex',gap:36,flexDirection:'column',width: '220px'}}>
        <input
          value={hostAccessKey}
          onChange={(event) => setHostAccessKey(event.target.value)}
          type="password"
          autoComplete="off"
          placeholder="Host access key"
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #A6A6A6',
            borderRadius: 8,
            fontSize: '16px'
          }}
        />
        <Button onClick={handleStartGame} disabled={isCreating}>
          {isCreating ? 'Starting...' : 'Start Game'}
        </Button>
      </div>
      {errorMessage ? (
        <p style={{ color: '#E03E3E', marginTop: 12 }}>{errorMessage}</p>
      ) : null}
    </div>
  )
}
