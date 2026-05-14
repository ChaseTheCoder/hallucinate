import ButtonLiquid from '../ButtonLiquid'
import VoteButton from '../VoteButton'
import { Player } from '../../types/types'

type LeaderDecisionPanelProps = {
  playerMessage: string | null
  decisionError: string | null
  decisionCandidates: Player[]
  decisionSelection: string | null
  isSubmittingDecision: boolean
  onSelectDecision: (playerId: string) => void
  onSubmitDecision: () => void
}

export default function LeaderDecisionPanel({
  playerMessage,
  decisionError,
  decisionCandidates,
  decisionSelection,
  isSubmittingDecision,
  onSelectDecision,
  onSubmitDecision,
}: LeaderDecisionPanelProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        width: '100%',
        height: '100%',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#5A5A5A', margin: '0 0 8px 0' }}>Leader Decision</h2>
        <p style={{ color: '#999', margin: 0, fontSize: '0.9em' }}>
          {playerMessage || 'Choose a player to bar from election.'}
        </p>
      </div>

      {decisionError && (
        <div
          style={{
            padding: 12,
            backgroundColor: '#ffebee',
            color: '#c62828',
            borderRadius: 4,
            fontSize: '0.9em',
            textAlign: 'center',
          }}
        >
          {decisionError}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {decisionCandidates.map((player) => (
          <VoteButton
            key={player.id}
            label={player.name}
            selected={decisionSelection === player.id}
            onClick={() => onSelectDecision(player.id)}
          />
        ))}
      </div>

      <div
        style={{
          width: '100vw',
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)',
          marginBottom: -24,
          padding: '16px 24px 64px 24px',
        }}
      >
        <ButtonLiquid
          onClick={onSubmitDecision}
          disabled={!decisionSelection || isSubmittingDecision}
          style={{
            width: '100%',
            opacity: decisionSelection ? 1 : 0.5,
            cursor: decisionSelection ? 'pointer' : 'not-allowed',
          }}
        >
          {isSubmittingDecision ? 'Submitting...' : 'Submit Decision'}
        </ButtonLiquid>
      </div>
    </div>
  )
}
