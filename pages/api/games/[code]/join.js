import { games } from '../../../../server/gameStore'

export default function handler(req, res) {
  if (req.method === 'POST') {
    const { code } = req.query
    const { name } = req.body

    const game = games[code]
    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    game.players.push({ name })

    // Broadcast to all connected clients watching this game
    if (res.socket.server.io) {
      res.socket.server.io.to(`game-${code}`).emit('players-updated', game.players)
    }

    res.status(200).json({ success: true, players: game.players })
  } else {
    res.status(405).end()
  }
}
