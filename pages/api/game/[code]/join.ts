import type { NextApiRequest, NextApiResponse } from 'next'
import { enrichGame, findGameByCode, getClientIp, persistGame } from '../../../../server/gameStore'
import type { Server as SocketIOServer } from 'socket.io'
import type { Server as NetServer, Socket } from 'net'
import { Game, Player } from '../../../../types/types'
import { checkJoinLimit } from '../../../../server/abuseGuard'

interface SocketServer extends NetServer {
  io?: SocketIOServer
}

interface SocketWithIO extends Socket {
  server: SocketServer
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { code } = req.query
    const { name } = req.body

    const ip = getClientIp(req.headers['x-forwarded-for'] || req.socket.remoteAddress)
    const limit = checkJoinLimit(ip)
    if (!limit.allowed) {
      if (limit.retryAfterSeconds) {
        res.setHeader('Retry-After', String(limit.retryAfterSeconds))
      }
      return res.status(429).json({ error: 'Too many join attempts. Please wait and try again.' })
    }
    
    // Find game by code
    const game = await findGameByCode(code as string)
    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    const typedGame = game as Game

    if (typedGame.status !== 'join') {
      return res.status(400).json({ error: 'Game has already started' })
    }

    if(typedGame.players.find(p => p.name === name)) {
      return  res.status(400).json({ error: 'Player name already taken in this game' })
    }

    // Ensure only one admin exists before adding new player
    const adminCount = typedGame.players.filter(p => p.isAdmin).length
    if (adminCount > 1) {
      // Fix corruption: remove extra admins, keep the first one
      typedGame.players.forEach((p, index) => {
        p.isAdmin = index === 0 && adminCount > 0
      })
    }

    // Check if any current player is already admin after cleanup
    const hasAdmin = typedGame.players.some(p => p.isAdmin === true)

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

    typedGame.players.push(newPlayer)
    await persistGame(typedGame)

    // Broadcast updated game state to all connected clients watching this game
    const resWithSocket = res as NextApiResponseWithSocket
    if (resWithSocket.socket?.server?.io) {
      resWithSocket.socket.server.io.to(`game-${code}`).emit('game-state-update', enrichGame(typedGame))
    }

    res.status(200).json({ success: true, players: typedGame.players, player: newPlayer })
  } else {
    res.status(405).end()
  }
}
