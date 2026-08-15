type PlayerHeaderProps = {
  playerName?: string
  isAdmin: boolean
}

// Leave Game now lives in the bottom nav's "Leave" tab (see components/player/BottomNav.tsx
// and pages/player/[code].tsx) rather than a top-right button here.
export default function PlayerHeader({ playerName, isAdmin }: PlayerHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: 24,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: '1em',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#5A5A5A',
          }}
        >
          {playerName || 'Player'}
        </div>
        {isAdmin && (
          <span
            style={{
              fontSize: '0.8em',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              color: '#5A5A5A',
            }}
          >
            Admin
          </span>
        )}
      </div>
    </div>
  )
}
