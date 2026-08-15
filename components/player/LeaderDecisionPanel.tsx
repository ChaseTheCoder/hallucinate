import { useState, useEffect } from 'react'
import ButtonLiquid from '../ButtonLiquid'
import VoteButton from '../VoteButton'
import type { ExecutiveDecisionType } from '../../types/types'

type Phase =
  | 'bar'
  | 'executive_decision'
  | 'immunity_code_confirm'
  | 'requalify_code_confirm'
  | 'swap_select'

const CODE_POPUP_COPY =
  "You will be provided a 4 letter code to provide a qualified immunity other than yourself. " +
  "It will appear during the CAMPAIGN phase on your screen. The player must type in the code " +
  "and submit it to work. The code is valid only for the next campaign cycle."

const REQUALIFY_POPUP_COPY =
  "You will be provided a 4 letter code to provide a barred player to become qualified again. " +
  "It will appear during the CAMPAIGN phase on your screen. The player must type in the code " +
  "and submit it to work. The code is valid only for the next campaign cycle."

const SWAP_SCREEN_COPY =
  "During the announcement of you executivie decisions, your choice will be announced. That player " +
  "then has 25 seconds to open their phone and select a player on their screen to bar. If they do " +
  "they then become qualified."

// Metadata for the leader-facing executive decision menu. Eligibility (which of these can
// appear as one of the 2 randomly-presented options) is filtered in handleBarSubmit below —
// requalify_code and barred_swap_chance both require at least one pre-existing barred
// player; immunity_code has no extra precondition. 'opt_out' is intentionally NOT listed
// here — it's the internal-only fallback auto-submitted (never shown to the leader) when
// qualified players <= 3.
const EXECUTIVE_DECISIONS: Array<{ id: ExecutiveDecisionType; title: string; requiresExistingBarred: boolean }> = [
  {
    id: 'immunity_code',
    title: 'Code for Immunity to Another Player in the Next Round',
    requiresExistingBarred: false,
  },
  {
    id: 'requalify_code',
    title: 'Code for a Barred Player to Become Qualified Again',
    requiresExistingBarred: true,
  },
  {
    id: 'barred_swap_chance',
    title: 'Give a Barred Player a Chance to Swap Back In',
    requiresExistingBarred: true,
  },
]

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
  const [executiveDecisionOptions, setExecutiveDecisionOptions] = useState<Array<{ id: ExecutiveDecisionType; title: string }>>([])
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

    // Executive decisions are only available when there are enough qualified players.
    // decisionCandidates excludes the leader, so total qualified = length + 1.
    const totalQualified = decisionCandidates.length + 1
    if (totalQualified <= 3) {
      onSubmitFinalDecision(barredId, 'opt_out')
      return
    }

    const hasExistingBarred = decisionBarredCandidates.length > 0

    const eligibleEDs = EXECUTIVE_DECISIONS.filter(ed => !ed.requiresExistingBarred || hasExistingBarred)

    const shuffledEDs = [...eligibleEDs].sort(() => Math.random() - 0.5)
    const selectedEDOptions = shuffledEDs.slice(0, Math.min(2, shuffledEDs.length))

    transitionTo('executive_decision', () => {
      setExecutiveDecisionOptions(selectedEDOptions)
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
          {executiveDecisionOptions.map(ed => (
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
            Continue
          </ButtonLiquid>
        </div>
      </div>
    )
  }

  if (phase === 'immunity_code_confirm' || phase === 'requalify_code_confirm') {
    const copy = phase === 'immunity_code_confirm' ? CODE_POPUP_COPY : REQUALIFY_POPUP_COPY
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
          Give a Barred Player a Chance to Swap Back In
        </h2>
        <p style={{ color: '#5A5A5A', margin: 0, lineHeight: 1.5 }}>
          {SWAP_SCREEN_COPY}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' }}>
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
