const { games } = require('../../../../server/gameStore')

export default function handler(req, res){
  const { code } = req.query
  const game = games[code]
  if (!game) return res.status(404).json({ error: 'Game not found' })
  if (req.method === 'GET'){
    return res.status(200).json({ code, players: game.players })
  }
  res.status(405).end()
}
