import type { NextApiRequest, NextApiResponse } from 'next'
import { games } from '../../../../server/gameStore'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query
  // Find game by code
  const game = Object.values(games).find(g => g.code === code as string)
  if (!game) return res.status(404).json({ error: 'Game not found' })
  if (req.method === 'GET') {
    return res.status(200).json(game)
  }
  res.status(405).end()
}
