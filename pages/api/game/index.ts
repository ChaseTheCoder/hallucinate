import type { NextApiRequest, NextApiResponse } from 'next'
import { createGame, getClientIp, persistGame } from '../../../server/gameStore'
import { checkCreateLimit, registerGameOwner } from '../../../server/abuseGuard'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const ip = getClientIp(req.headers['x-forwarded-for'] || req.socket.remoteAddress)
    const limit = checkCreateLimit(ip)
    if (!limit.allowed) {
      if (limit.retryAfterSeconds) {
        res.setHeader('Retry-After', String(limit.retryAfterSeconds))
      }
      return res.status(429).json({ error: 'Too many game creation attempts. Please try again later.' })
    }

    const game = await createGame()
    await persistGame(game)
    registerGameOwner(game.code, ip)
    return res.status(200).json(game)
  }
  res.status(405).end()
}
