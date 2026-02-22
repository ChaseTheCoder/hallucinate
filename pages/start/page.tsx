import { useState } from 'react'
import { useRouter } from 'next/router'
import Button from '../../components/Button'

export default function Start() {
  const [creating, setCreating] = useState(false)
  const [code, setCode] = useState('')
  const router = useRouter()

  async function createGame() {
    setCreating(true)
    const res = await fetch('/api/games', { method: 'POST' })
    const data = await res.json()
    setCode(data.code)
    setCreating(false)
    router.push(`/host/${data.code}`)
  }

  return (
    <div style={{padding:24}}>
      <h2>Start Game</h2>
      <p>Click the button to create a game and get a join code.</p>
      <Button onClick={createGame}>{creating ? 'Creating...' : 'Create Game'}</Button>
      {code && (
        <div style={{marginTop:16}}>
          <div>Code: <strong>{code}</strong></div>
          <div style={{marginTop:8}}>
            Share this URL: <a href={`/game/${code}`}>{window.location.origin}/game/{code}</a>
          </div>
        </div>
      )}
    </div>
  )
}
