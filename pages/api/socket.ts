import type { NextApiRequest, NextApiResponse } from 'next'
import { Server as HTTPServer } from 'http'
import { Socket as NetSocket } from 'net'
import { Server as IOServer } from 'socket.io'
import { games } from '../../server/gameStore'

interface SocketServer extends HTTPServer {
  io?: IOServer | undefined
}

interface SocketWithIO extends NetSocket {
  server: SocketServer
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO
}

const ioHandler = (req: NextApiRequest, res: NextApiResponseWithSocket) => {
  if (!res.socket) {
    res.end()
    return
  }

  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server, {
      cors: { origin: '*' }
    })

    io.on('connection', (socket) => {
      // Single subscription point for all game updates (host + players)
      // Consolidates game-${code} and game-status-${code} into one room
      socket.on('subscribe-to-game', (code: string) => {
        const game = Object.values(games).find(g => g.code === code)
        if (!game) {
          socket.emit('error', 'Game not found')
          return
        }

        const latestBarredId = game.rounds[game.currentRound]?.barred?.slice(-1)[0]
        const barredPlayerName = latestBarredId
          ? game.players.find(p => p.id === latestBarredId)?.name
          : null
        
        // Join unified game room
        socket.join(`game-${code}`)
        
        // Send complete initial game state (one emission instead of multiple)
        socket.emit('game-state-update', {
          players: game.players,
          status: game.status,
          barredPlayerName
        })
      })

      // Player-specific subscription for admin status and player data
      socket.on('subscribe-to-player', (data: { code: string, playerName: string }) => {
        const { code, playerName } = data
        const game = Object.values(games).find(g => g.code === code)
        if (!game) {
          socket.emit('error', 'Game not found')
          return
        }
        const player = game.players.find(p => p.name === playerName)
        if (!player) {
          socket.emit('error', 'Player not found')
          return
        }
        
        socket.join(`player-${code}-${playerName}`)
        // Send initial player state
        socket.emit('player-status-update', player)
      })

      socket.on('disconnect', () => {
        // Rooms are automatically cleaned up on disconnect
      })
    })

    res.socket.server.io = io
  }
  res.end()
}

export default ioHandler