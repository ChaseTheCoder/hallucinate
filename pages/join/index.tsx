import { useRef, useState } from 'react'
import { useRouter } from 'next/router'
import ButtonLiquid from '../../components/ButtonLiquid'

export default function Join() {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isCodeFocused, setIsCodeFocused] = useState(false)
  const codeInputRef = useRef<HTMLInputElement | null>(null)
  const router = useRouter()

  const codeSlots = Array.from({ length: 4 }, (_, index) => code[index] || '')
  const activeCodeSlotIndex = Math.min(code.length, 3)

  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = e.target.value
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 4)
    setCode(nextValue)
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (code.length !== 4 || !name) return setError('Enter a 4-letter code and name')
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
          <div
            role="button"
            tabIndex={0}
            onClick={() => codeInputRef.current?.focus()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                codeInputRef.current?.focus()
              }
            }}
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8
            }}
          >
            {codeSlots.map((char, index) => (
              <div
                key={index}
                style={{
                  position: 'relative',
                  height: 48,
                  border: '1px solid #c7c7c7',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25em',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  backgroundColor: '#fff'
                }}
              >
                {char}
                {isCodeFocused && code.length < 4 && index === activeCodeSlotIndex ? (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 2,
                      height: 24,
                      backgroundColor: '#222'
                    }}
                  />
                ) : null}
              </div>
            ))}
            <input
              ref={codeInputRef}
              aria-label="Game code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={4}
              value={code}
              onChange={handleCodeChange}
              onFocus={() => setIsCodeFocused(true)}
              onBlur={() => setIsCodeFocused(false)}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                fontSize: 16,
                width: '100%',
                height: '100%',
                cursor: 'text'
              }}
            />
          </div>
        </div>
        <div>
          <label style={{display: 'block', marginBottom: 4, fontWeight: 500}}>Your Name</label>
          <input 
            placeholder="Enter your display name" 
            value={name} 
            onChange={e=>setName(e.target.value)}
            style={{width: '100%', padding: '10px', boxSizing: 'border-box', fontSize: 16}}
          />
        </div>
        <ButtonLiquid onClick={handleJoin}>Join Game</ButtonLiquid>
      </form>
    </div>
  )
}
