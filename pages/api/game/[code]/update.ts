import type { NextApiRequest, NextApiResponse } from 'next'
import { emitRoleBasedGameUpdates, findGameByCode, persistGame } from '../../../../server/gameStore'
import type { Server as SocketIOServer } from 'socket.io'
import type { Server as NetServer, Socket } from 'net'
import { StatusTypes } from '../../../../types/types'

interface SocketServer extends NetServer {
  io?: SocketIOServer
}

interface SocketWithIO extends Socket {
  server: SocketServer
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO
}

// Fixed campaign duration for the final round (exactly 2 qualified players remain),
// overriding the host-configured game.cycleTime. Drives both the auto-transition check
// below AND the scripted two-candidate speech sequence on the host page (see
// finalRoundCampaignIntro/CandidateA/CandidateB in content/content.ts and the matching
// FINAL_ROUND_CAMPAIGN_SECONDS constant in pages/host/[code].tsx — keep both in sync if this
// changes). Candidate A speaks 0-60s elapsed, candidate B speaks 60-120s elapsed.
const FINAL_ROUND_CAMPAIGN_SECONDS = 120

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'PATCH') {
    const { code } = req.query

    const game = await findGameByCode(code as string)
    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    const currentStatus = game.status

    // Count qualified players. Computed up front (not just for the transition-selection
    // block below) because the final round's fixed campaign duration depends on it too.
    const qualifiedPlayerCount = game.players.filter(p => p.isQualified).length
    const campaignDurationSeconds = qualifiedPlayerCount === 2 ? FINAL_ROUND_CAMPAIGN_SECONDS : game.cycleTime

    let newStatus: StatusTypes | null = null

    // Auto-transition if timer expired
    if (currentStatus === 'campaign' && game.electionCycleStartTime > 0) {
      const elapsed = Date.now() - game.electionCycleStartTime
      if (elapsed >= campaignDurationSeconds * 1000) {
        newStatus = 'vote'
        console.log(`Campaign timer expired, auto-transitioning to vote`)
      }
    }

    if (!newStatus) {

      // State transitions
      if (currentStatus === 'join' && game.players.length >= 4) {
        newStatus = 'intro'
        // Qualify all players at start for testing
        game.players.forEach(p => p.isQualified = true)
      } else if (currentStatus === 'intro') {
        newStatus = 'rules'
      } else if (currentStatus === 'rules') {
        newStatus = 'campaign'
      } else if (currentStatus === 'campaign') {
        newStatus = 'vote'
        // Leader-granted codes (immunity/requalify) are "valid only for the next campaign
        // cycle" and are cleared here, whether redeemed or not. Barred-player-granted codes
        // (bar_leader/grant_immunity) have no round expiry — see ActiveRoundCode — and
        // persist here untouched until redeemed or their holder's influence is lost.
        game.activeCodes = (game.activeCodes ?? []).filter(c => c.validForRound === undefined)
      } else if (currentStatus === 'vote') {
        if (qualifiedPlayerCount === 2) {
          newStatus = 'final' // Final announcement after final vote
        } else {
          newStatus = 'results'
        }
      } else if (currentStatus === 'results') {
        newStatus = 'decision'
      } else if (currentStatus === 'decision') {
        newStatus = 'announcement'
      } else if (currentStatus === 'announcement') {
        newStatus = 'campaign'
        game.players.forEach(p => {
          p.hasVoted = false
          // 'post' influence: posts don't carry over rounds — clear this cycle's post and
          // re-open the one-post-per-cycle gate. postAlias is deliberately NOT cleared here
          // (it's permanent for as long as the player holds 'post' influence).
          p.currentPost = undefined
          if (p.influence === 'post') {
            p.hasPostedThisCycle = false
          }
        })
        game.currentRound += 1
        // Clear executive decision fields so the next round starts clean. NOTE: activeCodes
        // is deliberately NOT cleared here — leader-granted entries become redeemable
        // during the very campaign phase this transition starts (cleared at campaign ->
        // vote instead, above); barred-influence entries have no round expiry at all.
        delete game.executiveDecision
        delete game.swapWindow
      }
    }

    // One-time "barred candidate twist" trigger — checked at the same campaign -> vote
    // transition point as the qualifiedPlayerCount checks above (both the timer-expiry path
    // and the manual/fallback campaign->vote path converge on newStatus === 'vote' here, so
    // this only needs to live in one place). qualifiedPlayerCount was computed at the top of
    // this handler, from game state as of BEFORE this transition, which is exactly "how many
    // are qualified going into this round's vote" — the value this feature cares about.
    //
    // Firing requires >= 2 already-barred players so the special election has a meaningful
    // ballot (a single-candidate "vote" isn't meaningful). If qualifiedPlayerCount === 3 but
    // fewer than 2 players are barred yet, DO NOT set the permanent flag — leave the twist
    // eligible to fire on some future round where qualified count is 3 again with >= 2
    // barred players by then (this may never happen in a given game; that's an acceptable
    // outcome, forcing the twist with < 2 candidates is not).
    if (newStatus === 'vote' && !game.hasTriggeredBarredCandidateTwist && qualifiedPlayerCount === 3) {
      const barredPlayerCount = game.players.length - qualifiedPlayerCount
      if (barredPlayerCount >= 2) {
        game.hasTriggeredBarredCandidateTwist = true
        // currentRound hasn't been incremented yet (that only happens at
        // announcement -> campaign) — it still identifies the round we're entering vote
        // for, so this is the twist round's marker for the rest of this round's flow
        // (vote.ts, buildPlayerProjection). See the field doc in types/types.ts for why an
        // equality check against game.currentRound needs no explicit clearing later.
        game.activeTwistRound = game.currentRound
        console.log(`Barred candidate twist triggered for round ${game.currentRound}`)
      }
    }

    if (!newStatus) {
      let reason = 'Cannot transition from current status or conditions not met'
      if (currentStatus === 'join' && game.players.length < 4) {
        reason = 'Need at least 4 players to start'
      } else if (currentStatus === 'announcement' && qualifiedPlayerCount < 2) {
        reason = 'Need at least 2 qualified players to continue'
      }
      return res.status(400).json({ error: reason })
    }

    game.status = newStatus

    const latestBarredId = game.rounds[game.currentRound]?.barred?.slice(-1)[0]
    const barredPlayerName = latestBarredId
      ? game.players.find(p => p.id === latestBarredId)?.name
      : null

    // Set start time for campaign
    if (newStatus === 'campaign') {
      game.electionCycleStartTime = Date.now()
      // qualifiedPlayerCount reflects game.players.isQualified as of the top of this
      // request, unaffected by anything between here and there, so it's safe to reuse for
      // this log — see campaignDurationSeconds above for the actual enforced duration.
      console.log(`Campaign timer started for round ${game.currentRound}, time: ${campaignDurationSeconds}s${qualifiedPlayerCount === 2 ? ' (final round)' : ''}`)

      // Broadcast the campaign time for this specific round
      const resWithSocket = res as NextApiResponseWithSocket
      if (resWithSocket.socket?.server?.io) {
        emitRoleBasedGameUpdates(resWithSocket.socket.server.io, game)
      }
      await persistGame(game)
      return res.status(200).json({ success: true, status: newStatus })
    }

    // Broadcast complete game state to unified room (one emission)
    const resWithSocket = res as NextApiResponseWithSocket
    if (resWithSocket.socket?.server?.io) {
      emitRoleBasedGameUpdates(resWithSocket.socket.server.io, game)
    }

    await persistGame(game)

    res.status(200).json({ success: true, status: newStatus })
  } else {
    res.status(405).end()
  }
}
