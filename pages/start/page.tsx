import { useState } from 'react'
import { useRouter } from 'next/router'
import ButtonLiquid from '../../components/ButtonLiquid'

export default function Start() {
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  async function createGame() {
    setCreating(true)
    const res = await fetch('/api/games', { method: 'POST' })
    const data = await res.json()
    setCreating(false)
    router.push(`/host/${data.code}`)
  }

  return (
    <div style={{padding:24}}>
      <h2>Start Game</h2>
      <p>Click the button to create a game and get a join code.</p>
      <ButtonLiquid onClick={createGame}>{creating ? 'Creating...' : 'Create Game'}</ButtonLiquid>
    </div>
  )
}
