type ActiveCodeDisplayProps = {
  code: string
}

// Shown only to the leader who generated an immunity_code / requalify_code, only during the
// campaign phase it's valid for — never broadcast to the host or any other player (see
// buildPlayerProjection in server/gameStore.ts). Slot styling mirrors CodeRedeemPanel's
// entry widget so the code reads clearly, even though this is display-only.
//
// The copy is deliberately type-agnostic: it must never tell the leader (or, once they share
// it, anyone else) whether this code helps or harms the person who redeems it. That ambiguity
// is the point — a leader handing out a code they can't fully vouch for is where the game's
// trust/distrust tension lives. Don't reintroduce a type-conditional label here.
export default function ActiveCodeDisplay({ code }: ActiveCodeDisplayProps) {
  const chars = code.split('')

  return (
    <div style={{ marginTop: 16, width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <p style={{ color: '#5A5A5A', margin: 0, textAlign: 'center', fontSize: '0.9em' }}>
        You alone hold this code. Give it to whoever you choose — what it does to them once they use it is not yours to know.
      </p>
      <p style={{ color: '#999', margin: 0, textAlign: 'center', fontSize: '0.75em' }}>
        Valid only for this campaign cycle.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, width: '100%' }}>
        {chars.map((char, index) => (
          <div
            key={index}
            style={{
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
          </div>
        ))}
      </div>
    </div>
  )
}
