import type { NextApiRequest, NextApiResponse } from 'next'
import { emitRoleBasedGameUpdates, findGameByCode, persistGame } from '../../../../server/gameStore'
import type { Server as SocketIOServer } from 'socket.io'
import type { Server as NetServer, Socket } from 'net'

interface SocketServer extends NetServer {
  io?: SocketIOServer
}

interface SocketWithIO extends Socket {
  server: SocketServer
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO
}

const POST_MAX_LENGTH = 180

type PostAction = 'set-alias' | 'submit'

interface PostSubmission {
  playerId: string
  action: PostAction
  alias?: string // required for 'set-alias'
  text?: string // required for 'submit'
}

// Powers the 'post' barred-influence Post tab: setting a one-time fake-news alias, then
// submitting one post per campaign cycle under that alias (real identity never shown on
// the host screen — see the host-side post feed in pages/host/[code].tsx).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const { code } = req.query
  const { playerId, action, alias, text } = req.body as PostSubmission

  if (!playerId || !action) {
    return res.status(400).json({ error: 'Missing playerId or action' })
  }

  const game = await findGameByCode(code as string)
  if (!game) {
    return res.status(404).json({ error: 'Game not found' })
  }

  const player = game.players.find(p => p.id === playerId)
  if (!player) {
    return res.status(404).json({ error: 'Player not found' })
  }

  if (player.influence !== 'post') {
    return res.status(403).json({ error: 'You do not hold the post influence' })
  }

  if (action === 'set-alias') {
    if (player.postAlias) {
      return res.status(400).json({ error: 'Your alias is already set' })
    }
    const trimmedAlias = (alias ?? '').trim()
    if (!trimmedAlias) {
      return res.status(400).json({ error: 'Alias cannot be empty' })
    }
    player.postAlias = trimmedAlias
  } else if (action === 'submit') {
    if (!player.postAlias) {
      return res.status(400).json({ error: 'Confirm your alias before posting' })
    }
    if (game.status !== 'campaign') {
      return res.status(400).json({ error: 'Posts can only be submitted during the campaign phase' })
    }
    if (player.hasPostedThisCycle) {
      return res.status(400).json({ error: 'You have already posted this campaign cycle' })
    }
    const trimmedText = (text ?? '').trim()
    if (!trimmedText) {
      return res.status(400).json({ error: 'Post cannot be empty' })
    }
    if (trimmedText.length > POST_MAX_LENGTH) {
      return res.status(400).json({ error: `Post cannot exceed ${POST_MAX_LENGTH} characters` })
    }
    player.currentPost = trimmedText
    player.hasPostedThisCycle = true
  } else {
    return res.status(400).json({ error: 'Invalid action' })
  }

  const resWithSocket = res as NextApiResponseWithSocket
  if (resWithSocket.socket?.server?.io) {
    emitRoleBasedGameUpdates(resWithSocket.socket.server.io, game)
  }

  await persistGame(game)

  res.status(200).json({ success: true, postAlias: player.postAlias, hasPostedThisCycle: Boolean(player.hasPostedThisCycle) })
}
