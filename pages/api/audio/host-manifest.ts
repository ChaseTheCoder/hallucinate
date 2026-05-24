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
  return value === 'bar_another' || value === 'self_immunity_next_cycle' || value === 'grant_immunity_next_cycle' || value === 'opt_out'
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
      segments: getHostNarrationSegments(status, executiveDecision as ExecutiveDecisionType | undefined),
    })
    return
  }

  res.status(200).json({
    manifest: getHostNarrationManifest(),
  })
}
