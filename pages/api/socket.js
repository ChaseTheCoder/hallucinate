import { Server } from 'socket.io'
import { games } from '../../server/gameStore'

const ioHandler = (req, res) => {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server, {
      cors: { origin: '*' }
    })

    io.on('connection', (socket) => {
      // Subscribe to a game (for viewing the lobby)
      socket.on('subscribe-to-game', (code) => {
        const game = games[code]
        if (!game) {
          socket.emit('error', 'Game not found')
          return
        }
        socket.join(`game-${code}`)
        // Send current players to this client
        socket.emit('players-updated', game.players)
      })

      // Join game with a player name (from /join page)
      socket.on('join-game', (code, name) => {
        const game = games[code]
        if (!game) {
          socket.emit('error', 'Game not found')
          return
        }

        socket.join(`game-${code}`)
        game.players.push({ name })

        // Notify all players in this game
        io.to(`game-${code}`).emit('players-updated', game.players)
      })

      socket.on('disconnect', () => {
        // Optional: handle player disconnect
      })
    })

    res.socket.server.io = io
  }
  res.end()
}

export default ioHandler