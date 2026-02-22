import type { NextApiRequest, NextApiResponse } from 'next'
import { createGame } from '../../../server/gameStore'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const game = createGame()
    return res.status(200).json(game)
  }
  res.status(405).end()
}
