import type { ExecutiveDecisionType } from '../../types/types'

const submitDecision = async (
  gameCode: string,
  submittingLeaderId: string,
  submittingBarredId: string,
  executiveDecision: ExecutiveDecisionType,
  execDecisionTargetId?: string
) => {
  const res = await fetch(`/api/game/${gameCode}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leaderId: submittingLeaderId,
      barredId: submittingBarredId,
      executiveDecision,
      execDecisionTargetId
    })
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || 'Failed to submit decision')
  }
}

export default submitDecision