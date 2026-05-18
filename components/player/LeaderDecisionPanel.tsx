import { useState, useEffect } from 'react'
import ButtonLiquid from '../ButtonLiquid'
import VoteButton from '../VoteButton'
import type { ExecutiveDecisionType } from '../../types/types'

type Phase = 'bar' | 'executive_decision' | 'ed1_target'

const EXECUTIVE_DECISIONS: Array<{ id: ExecutiveDecisionType; title: string }> = [
  {
    id: 'bar_another',
    title: 'Bar Another Candidate of Two I Selected for You',
  },
  {
    id: 'opt_out',
    title: 'Opt Out of Executive Decision',
  },
]

type LeaderDecisionPanelProps = {
  decisionError: string | null
  decisionCandidates: Array<{ id: string; name: string }>
  isSubmittingDecision: boolean
  onSubmitFinalDecision: (barredId: string, ed: ExecutiveDecisionType, edTargetId?: string) => void
}

export default function LeaderDecisionPanel({
  decisionError,
  decisionCandidates,
  isSubmittingDecision,
  onSubmitFinalDecision,
}: LeaderDecisionPanelProps) {
  const [phase, setPhase] = useState<Phase>('bar')
  const [visible, setVisible] = useState(true)
  const [barredId, setBarredId] = useState<string | null>(null)
  const [selectedED, setSelectedED] = useState<ExecutiveDecisionType | null>(null)
  const [ed1TargetId, setED1TargetId] = useState<string | null>(null)
  const [ed1Candidates, setED1Candidates] = useState<Array<{ id: string; name: string }>>([])

  const transitionTo = (next: Phase, setup?: () => void) => {
    setVisible(false)
    setTimeout(() => {
      setup?.()
      setPhase(next)
      setVisible(true)
    }, 300)
  }

  // Reset ED1 target when candidates change
  useEffect(() => {
    setED1TargetId(null)
  }, [ed1Candidates])

  const handleBarSubmit = () => {
    if (!barredId) return

    // Executive decisions are only available when there are enough qualified players.
    // decisionCandidates excludes the leader, so total qualified = length + 1.
    const totalQualified = decisionCandidates.length + 1
    if (totalQualified <= 3) {
      onSubmitFinalDecision(barredId, 'opt_out')
      return
    }

    // Pick 2 random qualified players from remaining candidates (exclude chosen barred player)
    const pool = decisionCandidates.filter(p => p.id !== barredId)
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, 2)
    transitionTo('executive_decision', () => {
      setED1Candidates(picked)
      setSelectedED(null)
    })
  }

  const handleEDConfirm = () => {
    if (!selectedED || !barredId) return
    if (selectedED === 'opt_out') {
      onSubmitFinalDecision(barredId, 'opt_out')
    } else {
      transitionTo('ed1_target')
    }
  }

  const handleED1Confirm = () => {
    if (!ed1TargetId || !barredId) return
    onSubmitFinalDecision(barredId, 'bar_another', ed1TargetId)
  }

  const panelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    width: '100%',
    height: '100%',
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.3s ease',
  }

  const fixedBottomStyle: React.CSSProperties = {
    width: '100vw',
    marginLeft: 'calc(-50vw + 50%)',
    marginRight: 'calc(-50vw + 50%)',
    marginBottom: -24,
    padding: '16px 24px 64px 24px',
  }

  if (phase === 'bar') {
    return (
      <div style={panelStyle}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#5A5A5A', margin: '0 0 8px 0' }}>Leader Decision</h2>
          <p style={{ color: '#999', margin: 0, fontSize: '0.9em' }}>
            Choose a player to bar from election.
          </p>
        </div>

        {decisionError && (
          <div style={{ padding: 12, backgroundColor: '#ffebee', color: '#c62828', borderRadius: 4, fontSize: '0.9em', textAlign: 'center' }}>
            {decisionError}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' }}>
          {decisionCandidates.map(player => (
            <VoteButton
              key={player.id}
              label={player.name}
              selected={barredId === player.id}
              onClick={() => setBarredId(player.id)}
            />
          ))}
        </div>

        <div style={fixedBottomStyle}>
          <ButtonLiquid
            onClick={handleBarSubmit}
            disabled={!barredId}
            style={{ width: '100%', opacity: barredId ? 1 : 0.5, cursor: barredId ? 'pointer' : 'not-allowed' }}
          >
            Submit Decision
          </ButtonLiquid>
        </div>
      </div>
    )
  }

  if (phase === 'executive_decision') {
    return (
      <div style={panelStyle}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--color-text-primary)', margin: '0 0 8px 0', fontWeight: 700 }}>
            Choose an Executive Decision
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' }}>
          {EXECUTIVE_DECISIONS.map(ed => (
            <ButtonLiquid
              key={ed.id}
              onClick={() => setSelectedED(ed.id)}
              style={{
                width: '100%',
                opacity: selectedED === ed.id ? 1 : 0.6,
                outline: selectedED === ed.id ? '2px solid var(--color-text-primary)' : 'none',
              }}
            >
              {ed.title}
            </ButtonLiquid>
          ))}
        </div>

        <div style={fixedBottomStyle}>
          <ButtonLiquid
            onClick={handleEDConfirm}
            disabled={!selectedED || isSubmittingDecision}
            style={{ width: '100%', opacity: selectedED ? 1 : 0.5, cursor: selectedED ? 'pointer' : 'not-allowed' }}
          >
            {isSubmittingDecision ? 'Submitting...' : 'Confirm Executive Decision'}
          </ButtonLiquid>
        </div>
      </div>
    )
  }

  // phase === 'ed1_target'
  return (
    <div style={panelStyle}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-text-primary)', margin: '0 0 8px 0', fontWeight: 700 }}>
          Bar Another Candidate
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' }}>
        {ed1Candidates.map(player => (
          <VoteButton
            key={player.id}
            label={player.name}
            selected={ed1TargetId === player.id}
            onClick={() => setED1TargetId(player.id)}
          />
        ))}
      </div>

      <div style={fixedBottomStyle}>
        <ButtonLiquid
          onClick={handleED1Confirm}
          disabled={!ed1TargetId || isSubmittingDecision}
          style={{ width: '100%', opacity: ed1TargetId ? 1 : 0.5, cursor: ed1TargetId ? 'pointer' : 'not-allowed' }}
        >
          {isSubmittingDecision ? 'Submitting...' : 'Confirm'}
        </ButtonLiquid>
      </div>
    </div>
  )
}
