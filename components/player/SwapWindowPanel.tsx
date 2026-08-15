import { useEffect, useState } from 'react'
import ButtonLiquid from '../ButtonLiquid'
import VoteButton from '../VoteButton'

type SwapWindowPanelProps = {
  candidates: Array<{ id: string; name: string }>
  deadline: number // epoch ms — server-authoritative; local countdown is purely a display aid
  isSubmitting: boolean
  error: string | null
  onSubmit: (targetId: string) => void
}

// Shown only to the specific barred player currently holding an active barred_swap_chance
// window (see projection.swapWindow in server/gameStore.ts) — no other player ever sees
// this. The 25s countdown here is just a display convenience; the actual deadline is
// enforced server-side in pages/api/game/[code]/swap.ts regardless of this client's clock.
export default function SwapWindowPanel({ candidates, deadline, isSubmitting, error, onSubmit }: SwapWindowPanelProps) {
  const [targetId, setTargetId] = useState<string | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))

  useEffect(() => {
    const tick = () => setSecondsRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [deadline])

  const expired = secondsRemaining <= 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#5A5A5A', margin: '0 0 8px 0' }}>You Have a Chance to Requalify!</h2>
        <p style={{ color: '#999', margin: 0, fontSize: '0.9em' }}>
          Select a qualified candidate to bar in your place. You have {secondsRemaining}s.
        </p>
      </div>

      {error && (
        <div style={{ padding: 12, backgroundColor: '#ffebee', color: '#c62828', borderRadius: 4, fontSize: '0.9em', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {expired ? (
        <p style={{ color: '#999', textAlign: 'center' }}>Time's up.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto', padding: '4px' }}>
          {candidates.map(player => (
            <VoteButton
              key={player.id}
              label={player.name}
              selected={targetId === player.id}
              onClick={() => setTargetId(player.id)}
            />
          ))}
        </div>
      )}

      <div style={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)', marginBottom: -24, padding: '16px 24px 64px 24px' }}>
        <ButtonLiquid
          onClick={() => targetId && onSubmit(targetId)}
          disabled={!targetId || isSubmitting || expired}
          style={{ width: '100%', opacity: targetId && !expired ? 1 : 0.5, cursor: targetId && !expired ? 'pointer' : 'not-allowed' }}
        >
          {isSubmitting ? 'Submitting...' : 'Confirm Selection'}
        </ButtonLiquid>
      </div>
    </div>
  )
}
