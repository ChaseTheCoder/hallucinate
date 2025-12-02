const { games, createGame } = require('../../../server/gameStore')

export default function handler(req, res){
  if (req.method === 'POST'){
    const code = createGame()
    res.status(201).json({ code })
  } else {
    res.status(405).end()
  }
}
