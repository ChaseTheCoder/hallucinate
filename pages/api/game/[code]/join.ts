import type { NextApiRequest, NextApiResponse } from 'next'
import { games, enrichGame } from '../../../../server/gameStore'
import type { Server as SocketIOServer } from 'socket.io'
import type { Server as NetServer, Socket } from 'net'
import { Game, Player } from '../../../../types/types'

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

    const game = games[gameId] as Game;

    if (game.status !== 'join') {
      return res.status(400).json({ error: 'Game has already started' })
    }

    if(game.players.find(p => p.name === name)) {
      return  res.status(400).json({ error: 'Player name already taken in this game' })
    }

    // Ensure only one admin exists before adding new player
    const adminCount = game.players.filter(p => p.isAdmin).length
    if (adminCount > 1) {
      // Fix corruption: remove extra admins, keep the first one
      game.players.forEach((p, index) => {
        p.isAdmin = index === 0 && adminCount > 0
      })
    }

    // Check if any current player is already admin after cleanup
    const hasAdmin = game.players.some(p => p.isAdmin === true)

    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: name,
      votes: 0,
      leader: false,
      isQualified: true,
      roundsBarred: 0,
      isAdmin: !hasAdmin,  // Only the first player becomes admin
      hasVoted: false,
      isConnected: true
    }

    game.players.push(newPlayer)

    // Broadcast updated game state to all connected clients watching this game
    const resWithSocket = res as NextApiResponseWithSocket
    if (resWithSocket.socket?.server?.io) {
      resWithSocket.socket.server.io.to(`game-${code}`).emit('game-state-update', enrichGame(game))
    }

    res.status(200).json({ success: true, players: game.players, player: newPlayer })
  } else {
    res.status(405).end()
  }
}
