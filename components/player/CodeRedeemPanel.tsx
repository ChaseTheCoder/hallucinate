import { useRef, useState } from 'react'
import ButtonLiquid from '../ButtonLiquid'

type CodeRedeemPanelProps = {
  onSubmit: (code: string) => void
  isSubmitting: boolean
  error: string | null
}

// Same 4-slot boxed code entry pattern as pages/join/index.tsx (codeSlots/activeCodeSlotIndex/
// isCodeFocused + a transparent overlay <input> capturing the actual typing), reused here so
// redeeming an executive-decision code feels identical to entering a game code.
export default function CodeRedeemPanel({ onSubmit, isSubmitting, error }: CodeRedeemPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [code, setCode] = useState('')
  const [isCodeFocused, setIsCodeFocused] = useState(false)
  const codeInputRef = useRef<HTMLInputElement | null>(null)

  const codeSlots = Array.from({ length: 4 }, (_, index) => code[index] || '')
  const activeCodeSlotIndex = Math.min(code.length, 3)

  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = e.target.value
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 4)
    setCode(nextValue)
  }

  function handleSubmit() {
    if (code.length !== 4) return
    onSubmit(code)
  }

  if (!expanded) {
    return (
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <ButtonLiquid onClick={() => setExpanded(true)} style={{ opacity: 0.8 }}>
          Have a Code?
        </ButtonLiquid>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16, width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ color: '#5A5A5A', margin: 0, textAlign: 'center', fontSize: '0.9em' }}>
        Enter the 4-letter code you were given.
      </p>

      {error && (
        <div style={{ color: '#c62828', fontSize: '0.85em', textAlign: 'center' }}>{error}</div>
      )}

      <div
        onClick={() => codeInputRef.current?.focus()}
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          cursor: 'text'
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
          aria-label="Redemption code"
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

      <ButtonLiquid
        onClick={handleSubmit}
        disabled={code.length !== 4 || isSubmitting}
        style={{ width: '100%', opacity: code.length === 4 ? 1 : 0.5, cursor: code.length === 4 ? 'pointer' : 'not-allowed' }}
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </ButtonLiquid>
    </div>
  )
}
