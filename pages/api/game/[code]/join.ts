import type { NextApiRequest, NextApiResponse } from 'next'
import { games } from '../../../../server/gameStore'
import type { Server as SocketIOServer } from 'socket.io'
import type { Server as NetServer, Socket } from 'net'
import { Player } from '../../../../types/types'

interface SocketServer extends NetServer {
  io?: SocketIOServer
}

interface SocketWithIO extends Socket {
  server: SocketServer
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { code } = req.query
    const { name } = req.body
    
    // Find game by code
    const gameId = Object.keys(games).find(id => games[id].code === code as string)
    if (!gameId) {
      return res.status(404).json({ error: 'Game not found' })
    }

    const game = games[gameId]

    if (game.status !== 'join') {
      return res.status(400).json({ error: 'Game has already started' })
    }

    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: name,
      votes: 0,
      leader: false,
      isQualified: true,
      roundsBarred: 0,
      isAdmin: false
    }

    if(game.players.find(p => p.name === name)) {
      return  res.status(400).json({ error: 'Player name already taken in this game' })
    }

    if(!game.players.find(p => p.isAdmin === true)) {
      newPlayer.isAdmin = true;
    }

    game.players.push(newPlayer)

    // Broadcast updated game state to all connected clients watching this game
    const resWithSocket = res as NextApiResponseWithSocket
    if (resWithSocket.socket?.server?.io) {
      resWithSocket.socket.server.io.to(`game-${code}`).emit('game-state-update', {
        players: game.players,
        status: game.status
      })
    }

    res.status(200).json({ success: true, players: game.players, player: newPlayer })
  } else {
    res.status(405).end()
  }
}
