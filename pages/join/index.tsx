import { useState } from 'react'
import { useRouter } from 'next/router'
import ButtonLiquid from '../../components/ButtonLiquid'

export default function Join() {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!code || !name) return setError('Enter code and name')
    const res = await fetch(`/api/game/${code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    if (!res.ok) {
      const j = await res.json()
      setError(j.error || 'Failed to join')
      return
    }
    router.push(`/player/${code}?name=${encodeURIComponent(name)}`)
  }

  return (
    <div style={{padding:24, maxWidth: 400, margin: '0 auto'}}>
      <h2>Join Game</h2>
      
      {error && <div style={{color:'red', fontSize: '0.9em', marginBottom: 12}}>{error}</div>}

      <form onSubmit={handleJoin} style={{display:'flex',flexDirection:'column',gap:12}}>
        <div>
          <label style={{display: 'block', marginBottom: 4, fontWeight: 500}}>Game Code</label>
          <input 
            placeholder="Enter game code" 
            value={code} 
            onChange={e=>setCode(e.target.value.toUpperCase())}
            style={{width: '100%', padding: '10px', boxSizing: 'border-box', fontSize: '1.1em', fontFamily: 'monospace'}}
          />
        </div>
        <div>
          <label style={{display: 'block', marginBottom: 4, fontWeight: 500}}>Your Name</label>
          <input 
            placeholder="Enter your display name" 
            value={name} 
            onChange={e=>setName(e.target.value)}
            style={{width: '100%', padding: '10px', boxSizing: 'border-box'}}
          />
        </div>
        <ButtonLiquid onClick={handleJoin}>Join Game</ButtonLiquid>
      </form>
    </div>
  )
}
