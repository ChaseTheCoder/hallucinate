import ButtonLiquid from '../ButtonLiquid'

type PlayerHeaderProps = {
  playerName?: string
  isAdmin: boolean
  onLeaveGame: () => void
}

export default function PlayerHeader({ playerName, isAdmin, onLeaveGame }: PlayerHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
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
      <ButtonLiquid onClick={onLeaveGame}>Leave Game</ButtonLiquid>
    </div>
  )
}
