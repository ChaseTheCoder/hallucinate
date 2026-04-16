import type { NextApiRequest, NextApiResponse } from 'next'
import { Server as HTTPServer } from 'http'
import { Socket as NetSocket } from 'net'
import { Server as IOServer } from 'socket.io'
import { games, enrichGame } from '../../server/gameStore'

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
    
    // Map to track socket-to-player associations for disconnect handling
    const socketToPlayer: Map<string, { code: string, playerName: string }> = new Map()

    io.on('connection', (socket) => {
      // Single subscription point - broadcasts complete enriched game state to all clients
      socket.on('subscribe-to-game', (code: string) => {
        const game = Object.values(games).find(g => g.code === code)
        if (!game) {
          socket.emit('error', 'Game not found')
          return
        }

        // Ensure data integrity: only one admin should exist
        const adminCount = game.players.filter(p => p?.isAdmin).length
        if (adminCount > 1) {
          // Multiple admins detected - keep only the first one
          let foundFirst = false
          game.players.forEach(p => {
            if (p.isAdmin && !foundFirst) {
              foundFirst = true
            } else {
              p.isAdmin = false
            }
          })
        } else if (adminCount === 0 && game.players.length > 0 && game.status === 'join') {
          // No admin exists but we're in join phase - make first player admin
          game.players[0].isAdmin = true
        }
        
        // Join unified game room
        socket.join(`game-${code}`)
        
        // Send enriched game state with computed fields
        socket.emit('game-state-update', enrichGame(game))
      })

      // Player connection tracking - separate from data broadcasting
      socket.on('subscribe-to-player', (data: { code: string, playerName?: string, playerId?: string }) => {
        const { code, playerName, playerId } = data
        const game = Object.values(games).find(g => g.code === code)
        if (!game) {
          socket.emit('error', 'Game not found')
          return
        }

        let player = playerId ? game.players.find(p => p.id === playerId) : undefined
        if (!player && playerName) {
          player = game.players.find(p => p.name === playerName)
        }
        if (!player) {
          socket.emit('error', 'Player not found')
          return
        }

        const resolvedPlayerName = player.name

        // Track socket-to-player association for disconnect handling
        socketToPlayer.set(socket.id, { code, playerName: resolvedPlayerName })

        // Mark player as reconnected if they were previously disconnected
        if (!player.isConnected) {
          player.isConnected = true
          io.to(`game-${code}`).emit('player-reconnected', {
            playerName: resolvedPlayerName,
            playerId: player.id,
            message: `${resolvedPlayerName} has reconnected`
          })
        }

        // Safety check: ensure only one admin exists
        if (player.isAdmin) {
          const otherAdmins = game.players.filter(p => p.id !== player.id && p.isAdmin)
          if (otherAdmins.length > 0) {
            otherAdmins.forEach(p => p.isAdmin = false)
          }
        } else if (!game.players.some(p => p.isAdmin)) {
          player.isAdmin = true
        }

        socket.join(`player-${code}-${resolvedPlayerName}`)
      })

      socket.on('disconnect', () => {
        // Mark player as disconnected when socket closes
        const playerInfo = socketToPlayer.get(socket.id)
        if (playerInfo) {
          const { code, playerName } = playerInfo
          const game = Object.values(games).find(g => g.code === code)
          if (game) {
            const player = game.players.find(p => p.name === playerName)
            if (player) {
              player.isConnected = false
              
              // Broadcast disconnection to all players in game
              io.to(`game-${code}`).emit('player-disconnected', {
                playerName,
                playerId: player.id,
                message: `${playerName} has disconnected`
              })
            }
          }
          socketToPlayer.delete(socket.id)
        }
      })
    })

    res.socket.server.io = io
  }
  res.end()
}

export default ioHandler