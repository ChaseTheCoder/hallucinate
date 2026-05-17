import ButtonLiquid from '../ButtonLiquid'

type CampaignTimePanelProps = {
  cycleTimeInput: string
  onCycleTimeChange: (value: string) => void
  onStartGame: () => void
  playerCount: number
  canStartGame: boolean
  startBlockedReason?: string
}

export default function CampaignTimePanel({
  cycleTimeInput,
  onCycleTimeChange,
  onStartGame,
  playerCount,
  canStartGame,
  startBlockedReason,
}: CampaignTimePanelProps) {
  return (
    <>
      <p
        style={{
          color: '#5A5A5A',
          textAlign: 'center',
          marginTop: 12,
        }}
      >
        Set campaign time per round (seconds):
      </p>
      <input
        type="number"
        min="5"
        max="60"
        value={cycleTimeInput}
        onChange={(e) => onCycleTimeChange(e.target.value)}
        style={{
          padding: '8px 12px',
          fontSize: '1em',
          border: '1px solid #5A5A5A',
          borderRadius: 4,
          textAlign: 'center',
          width: '120px',
        }}
      />
      <ButtonLiquid
        onClick={onStartGame}
        disabled={!canStartGame}
        style={{ marginTop: 12 }}
      >
        Start Game
      </ButtonLiquid>
      {!canStartGame && (
        <p
          style={{
            color: '#E03E3E',
            textAlign: 'center',
            marginTop: 8,
            fontSize: '0.9em',
          }}
        >
          {startBlockedReason || `Need at least 4 players to start (${playerCount}/4)`}
        </p>
      )}
    </>
  )
}
