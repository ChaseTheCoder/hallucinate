import type { NextApiRequest, NextApiResponse } from 'next'
import { buildPlayerProjection, findGameByCode, enrichGame, sanitizeGameForHost } from '../../../../server/gameStore'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query

  if (req.method === 'GET') {
    const game = await findGameByCode(code as string)
    if (!game) return res.status(404).json({ error: 'Game not found' })

    const role = Array.isArray(req.query.role) ? req.query.role[0] : req.query.role
    if (role === 'player') {
      const requestedPlayerId = Array.isArray(req.query.playerId) ? req.query.playerId[0] : req.query.playerId
      const requestedPlayerName = Array.isArray(req.query.playerName) ? req.query.playerName[0] : req.query.playerName
      const player = requestedPlayerId
        ? game.players.find(p => p.id === requestedPlayerId)
        : game.players.find(p => p.name === requestedPlayerName)

      if (!player) {
        return res.status(404).json({ error: 'Player not found' })
      }

      return res.status(200).json(buildPlayerProjection(enrichGame(game), player))
    }

    return res.status(200).json(sanitizeGameForHost(enrichGame(game)))
  }
  res.status(405).end()
}
