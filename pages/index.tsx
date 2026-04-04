import { useState } from 'react'
import { useRouter } from 'next/router'
import Lucin from '../components/Lucin'
import Button from '../components/Button'

export default function Home() {
  const [isCreating, setIsCreating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const router = useRouter()

  async function handleStartGame() {
    setIsCreating(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/game', { method: 'POST' })
      if (!res.ok) {
        throw new Error(`Failed to create game: ${res.statusText}`)
      }
      const game = await res.json()
      if (!game.code) {
        throw new Error('Invalid game response: missing code')
      }
      router.push(`/host/${game.code}`)
    } catch (error) {
      console.error(error)
      setErrorMessage('Error creating game. Please try again.')
      setIsCreating(false)
    }
  }

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:20}}>
      <Lucin height="40%" />
      <h1>Hallucinate</h1>
      <div style={{display:'flex',gap:36,flexDirection:'column',width: '220px'}}>
        <Button onClick={handleStartGame} disabled={isCreating}>
          {isCreating ? 'Starting...' : 'Start Game'}
        </Button>
        <Button href="/join">Join Game</Button>
      </div>
      {errorMessage ? (
        <p style={{ color: '#E03E3E', marginTop: 12 }}>{errorMessage}</p>
      ) : null}
    </div>
  )
}
