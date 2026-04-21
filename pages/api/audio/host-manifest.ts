import type { NextApiRequest, NextApiResponse } from 'next'
import { getHostNarrationManifest, getHostNarrationSegments } from '../../../content/hostNarration'
import { StatusTypes } from '../../../types/types'

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

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

  const rawStatus = req.query.status
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus

  if (status) {
    if (!isStatus(status)) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }

    res.status(200).json({
      status,
      segments: getHostNarrationSegments(status),
    })
    return
  }

  res.status(200).json({
    manifest: getHostNarrationManifest(),
  })
}
