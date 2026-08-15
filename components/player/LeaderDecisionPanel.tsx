import { useState, useEffect } from 'react'
import ButtonLiquid from '../ButtonLiquid'
import VoteButton from '../VoteButton'
import type { ExecutiveDecisionType } from '../../types/types'
import { EXECUTIVE_DECISION_TITLES, EXECUTIVE_DECISION_PROMPTS } from '../../content/content'

type Phase =
  | 'bar'
  | 'executive_decision'
  | 'immunity_code_confirm'
  | 'requalify_code_confirm'
  | 'swap_select'

// Eligibility metadata for the leader-facing executive decision menu (display content —
// titles/prompts — lives in content/content.ts, keyed by the same ExecutiveDecisionType).
// Eligibility (which of these can appear as one of the 2 randomly-presented options) is
// filtered in handleBarSubmit below — requalify_code and barred_swap_chance both require at
// least one pre-existing barred player; immunity_code has no extra precondition. 'opt_out' is
// intentionally NOT listed here — it's a permanent 3rd menu option (see OPT_OUT_ID) appended
// alongside the 2 randomly-selected ones below, not part of the random-selection pool. It's
// also the internal-only fallback auto-submitted (never shown to the leader at all) when
// qualified players <= 4 (see totalQualified check in handleBarSubmit).
const EXECUTIVE_DECISIONS: Array<{ id: ExecutiveDecisionType; requiresExistingBarred: boolean }> = [
  { id: 'immunity_code', requiresExistingBarred: false },
  { id: 'requalify_code', requiresExistingBarred: true },
  { id: 'barred_swap_chance', requiresExistingBarred: true },
]

// Always offered in addition to the 2 randomly-selected decisions above, every time the ED
// menu is shown at all — not part of the random-2 pool.
const OPT_OUT_ID: ExecutiveDecisionType = 'opt_out'

type LeaderDecisionPanelProps = {
  decisionError: string | null
  decisionCandidates: Array<{ id: string; name: string }>
  decisionBarredCandidates: Array<{ id: string; name: string }>
  isSubmittingDecision: boolean
  onSubmitFinalDecision: (barredId: string, ed: ExecutiveDecisionType, edTargetId?: string) => void
}

export default function LeaderDecisionPanel({
  decisionError,
  decisionCandidates,
  decisionBarredCandidates,
  isSubmittingDecision,
  onSubmitFinalDecision,
}: LeaderDecisionPanelProps) {
  const [phase, setPhase] = useState<Phase>('bar')
  const [visible, setVisible] = useState(true)
  const [barredId, setBarredId] = useState<string | null>(null)
  const [selectedED, setSelectedED] = useState<ExecutiveDecisionType | null>(null)
  const [executiveDecisionOptions, setExecutiveDecisionOptions] = useState<ExecutiveDecisionType[]>([])
  const [swapCandidateId, setSwapCandidateId] = useState<string | null>(null)

  const transitionTo = (next: Phase, setup?: () => void) => {
    setVisible(false)
    setTimeout(() => {
      setup?.()
      setPhase(next)
      setVisible(true)
    }, 300)
  }

  // Reset swap candidate selection whenever the barred-candidate pool changes.
  useEffect(() => {
    setSwapCandidateId(null)
  }, [decisionBarredCandidates])

  const handleBarSubmit = () => {
    if (!barredId) return

    // Executive decisions are only available when there are enough qualified players (5+).
    // decisionCandidates excludes the leader, so total qualified = length + 1.
    const totalQualified = decisionCandidates.length + 1
    if (totalQualified <= 4) {
      onSubmitFinalDecision(barredId, 'opt_out')
      return
    }

    const hasExistingBarred = decisionBarredCandidates.length > 0

    const eligibleEDs = EXECUTIVE_DECISIONS.filter(ed => !ed.requiresExistingBarred || hasExistingBarred)

    const shuffledEDs = [...eligibleEDs].sort(() => Math.random() - 0.5)
    const selectedEDOptions = shuffledEDs.slice(0, Math.min(2, shuffledEDs.length))

    transitionTo('executive_decision', () => {
      // 'Make no executive decision' is always appended as a permanent 3rd option — it is
      // never part of the random-2 selection.
      setExecutiveDecisionOptions([...selectedEDOptions.map(ed => ed.id), OPT_OUT_ID])
      setSelectedED(null)
    })
  }

  const handleEDConfirm = () => {
    if (!selectedED || !barredId) return
    if (selectedED === 'immunity_code') {
      transitionTo('immunity_code_confirm')
    } else if (selectedED === 'requalify_code') {
      transitionTo('requalify_code_confirm')
    } else if (selectedED === 'barred_swap_chance') {
      transitionTo('swap_select')
    } else if (selectedED === 'opt_out') {
      // No dedicated confirm screen needed — submits directly from the existing
      // select+Continue flow, same trigger point as the other options' first click.
      onSubmitFinalDecision(barredId, 'opt_out')
    }
  }

  const handleImmunityCodeConfirm = () => {
    if (!barredId) return
    onSubmitFinalDecision(barredId, 'immunity_code')
  }

  const handleRequalifyCodeConfirm = () => {
    if (!barredId) return
    onSubmitFinalDecision(barredId, 'requalify_code')
  }

  const handleSwapSelectConfirm = () => {
    if (!barredId || !swapCandidateId) return
    onSubmitFinalDecision(barredId, 'barred_swap_chance', swapCandidateId)
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto', padding: '4px' }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto', padding: '4px' }}>
          {executiveDecisionOptions.map(edId => (
            <ButtonLiquid
              key={edId}
              onClick={() => setSelectedED(edId)}
              style={{
                width: '100%',
                opacity: selectedED === edId ? 1 : 0.6,
                outline: selectedED === edId ? '2px solid var(--color-text-primary)' : 'none',
              }}
            >
              {EXECUTIVE_DECISION_TITLES[edId]}
            </ButtonLiquid>
          ))}
        </div>

        <div style={fixedBottomStyle}>
          <ButtonLiquid
            onClick={handleEDConfirm}
            disabled={!selectedED || isSubmittingDecision}
            style={{ width: '100%', opacity: selectedED ? 1 : 0.5, cursor: selectedED ? 'pointer' : 'not-allowed' }}
          >
            Continue
          </ButtonLiquid>
        </div>
      </div>
    )
  }

  if (phase === 'immunity_code_confirm' || phase === 'requalify_code_confirm') {
    const copy = EXECUTIVE_DECISION_PROMPTS[phase === 'immunity_code_confirm' ? 'immunity_code' : 'requalify_code']
    const onConfirm = phase === 'immunity_code_confirm' ? handleImmunityCodeConfirm : handleRequalifyCodeConfirm

    return (
      <div style={panelStyle}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16, flex: 1, justifyContent: 'center' }}>
          <h2 style={{ color: 'var(--color-text-primary)', margin: 0, fontWeight: 700 }}>
            Confirm Executive Decision
          </h2>
          <p style={{ color: '#5A5A5A', margin: 0, lineHeight: 1.5 }}>
            {copy}
          </p>
        </div>

        <div style={fixedBottomStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ButtonLiquid
              onClick={onConfirm}
              disabled={isSubmittingDecision}
              style={{ width: '100%' }}
            >
              {isSubmittingDecision ? 'Submitting...' : 'Confirm Choice'}
            </ButtonLiquid>
            <ButtonLiquid
              onClick={() => transitionTo('executive_decision')}
              disabled={isSubmittingDecision}
              style={{ width: '100%', opacity: 0.7 }}
            >
              Go Back
            </ButtonLiquid>
          </div>
        </div>
      </div>
    )
  }

  // phase === 'swap_select'
  return (
    <div style={panelStyle}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-text-primary)', margin: '0 0 8px 0', fontWeight: 700 }}>
          {EXECUTIVE_DECISION_TITLES.barred_swap_chance}
        </h2>
        <p style={{ color: '#5A5A5A', margin: 0, lineHeight: 1.5 }}>
          {EXECUTIVE_DECISION_PROMPTS.barred_swap_chance}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto', padding: '4px' }}>
        {decisionBarredCandidates.map(player => (
          <VoteButton
            key={player.id}
            label={player.name}
            selected={swapCandidateId === player.id}
            onClick={() => setSwapCandidateId(player.id)}
          />
        ))}
      </div>

      <div style={fixedBottomStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ButtonLiquid
            onClick={handleSwapSelectConfirm}
            disabled={!swapCandidateId || isSubmittingDecision}
            style={{ width: '100%', opacity: swapCandidateId ? 1 : 0.5, cursor: swapCandidateId ? 'pointer' : 'not-allowed' }}
          >
            {isSubmittingDecision ? 'Submitting...' : 'Confirm Choice'}
          </ButtonLiquid>
          <ButtonLiquid
            onClick={() => transitionTo('executive_decision')}
            disabled={isSubmittingDecision}
            style={{ width: '100%', opacity: 0.7 }}
          >
            Go Back
          </ButtonLiquid>
        </div>
      </div>
    </div>
  )
}
