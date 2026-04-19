import type { NextApiRequest, NextApiResponse } from 'next'
import { findGameByCode } from '../../../../server/gameStore'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query

  if (req.method === 'GET') {
    const game = await findGameByCode(code as string)
    if (!game) return res.status(404).json({ error: 'Game not found' })
    return res.status(200).json(game)
  }
  res.status(405).end()
}
