import type { NextApiRequest, NextApiResponse } from 'next'
import { getHostNarrationManifest, getHostNarrationSegments } from '../../../content/hostNarration'
import { ExecutiveDecisionType, StatusTypes } from '../../../types/types'

const validStatuses: StatusTypes[] = [
  'join',
  'rules',
  'campaign',
  'vote',
  'results',
  'decision',
  'announcement',
  'final',
]

function isStatus(value: string): value is StatusTypes {
  return validStatuses.includes(value as StatusTypes)
}

function isExecutiveDecision(value: string): value is ExecutiveDecisionType {
  return value === 'immunity_code' || value === 'requalify_code' || value === 'barred_swap_chance' || value === 'opt_out'
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

  const rawStatus = req.query.status
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus
  const rawExecutiveDecision = req.query.executiveDecision
  const executiveDecision = Array.isArray(rawExecutiveDecision) ? rawExecutiveDecision[0] : rawExecutiveDecision
  // Preview-only flag for the one-time barred-candidate-twist vote narration extension
  // (see barredCandidateTwistVoteExtension in content/content.ts) — only meaningful when
  // status === 'vote'.
  const rawIsTwistRound = req.query.isTwistRound
  const isTwistRound = (Array.isArray(rawIsTwistRound) ? rawIsTwistRound[0] : rawIsTwistRound) === 'true'

  if (status) {
    if (!isStatus(status)) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }

    if (executiveDecision && !isExecutiveDecision(executiveDecision)) {
      res.status(400).json({ error: 'Invalid executive decision' })
      return
    }

    res.status(200).json({
      status,
      segments: getHostNarrationSegments(status, executiveDecision as ExecutiveDecisionType | undefined, isTwistRound),
    })
    return
  }

  res.status(200).json({
    manifest: getHostNarrationManifest(),
  })
}
