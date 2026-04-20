import type { NextApiRequest, NextApiResponse } from 'next'
import { createGame, getClientIp, persistGame } from '../../../server/gameStore'
import { checkCreateLimit, isHostAccessAllowed, registerGameOwner } from '../../../server/abuseGuard'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      if (!isHostAccessAllowed(req.headers['x-host-access-key'])) {
        return res.status(401).json({ error: 'Host verification failed' })
      }

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
    } catch (error) {
      console.error('Create game failed:', error)
      const message = error instanceof Error ? error.message : 'Failed to create game'
      return res.status(500).json({ error: message })
    }
  }
  res.status(405).end()
}
