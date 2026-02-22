import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Lucin from '../../components/Lucin'

export default function Start() {
  const [stateMessage, setStateMessage] = useState('Hello...')
  const router = useRouter()

  async function createGame() {
    const res = await fetch('/api/game', { method: 'POST' })
    if (!res.ok) {
      throw new Error(`Failed to create game: ${res.statusText}`)
    }
    const game = await res.json()
    if (!game.code) {
      throw new Error('Invalid game response: missing code')
    }
    router.push(`/host/${game.code}`)
  }

  useEffect(() => {
    try {
      setStateMessage('...Creating Game')
      createGame()
    } catch (e) {
      console.error(e)
      setStateMessage('Error creating game. Please try again.')
    }
  }, [])

  return (
    <>
      <Lucin height="30%" />
      <p>{stateMessage}</p> 
    </>
  );
}
