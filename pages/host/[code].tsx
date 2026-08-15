import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Text from '../../components/Text'
import { useRouter } from 'next/router'
import io, { Socket } from 'socket.io-client'
import Lucin from '../../components/Lucin'
import Nav from '../../components/host/Nav'
import Right from '../../components/host/Right'
import Popover from '../../components/Popover'
import ButtonLiquid from '../../components/ButtonLiquid'
import CodeEventToast, { type CodeEventToastData } from '../../components/host/CodeEventToast'
import PostFeed from '../../components/host/PostFeed'
import { Game } from '../../types/types'
import {
  gameContent,
  introductionAnnouncementExtension,
  finalRoundCampaignIntro,
  finalRoundCampaignCandidateA,
  finalRoundCampaignCandidateB,
} from '../../content/content'
import { DEFAULT_HOST_PAUSE_MS, getHostNarrationSegment, getAudioUrlForText, isDynamicTokenLine } from '../../content/hostNarration'
import updateGame from '../../utils/updateGame'
import useStatusMusic from '../../utils/host/useStatusMusic'
import { formatHostMessage, getExtendedAnnouncementHostMessages, shouldHostMessageBeBold } from '../../utils/host/utils'
import { getHostMessageDisplayText, isHostMessageHeading, type HostMessageEntry } from '../../content/hostNarration'

let socket: Socket | null = null
const AUTO_TRANSITION_STATUSES: Game['status'][] = ['rules', 'results', 'announcement']

// Timing for the 'intro' sequence, per spec: ~3s total for the 3 components to fade out
// (1s each, sequential), a "slow" fade for text elements, and a 1.5s gap between each
// narration clip for entry 0's title/noun/definition trio.
const INTRO_COMPONENT_FADE_MS = 1000
const INTRO_TEXT_FADE_MS = 2000
const INTRO_AUDIO_GAP_MS = 1500
// Window over which the title's non-"lucin" letters fade away at random, each with its
// own randomly-staggered start so they don't all disappear in lockstep.
const INTRO_LETTER_SCRAMBLE_MS = 2000
const INTRO_LETTER_FADE_MS = 400
// 'lucin' alone holds on screen this long before it, too, fades away.
const INTRO_LUCIN_HOLD_MS = 5000
// Extra dramatic pause before the last entry (the "twist") displays/plays.
const INTRO_FINAL_PAUSE_MS = 5000

// content.ts doesn't declare an explicit type for this export; entry 0 nests noun+definition
// under `content` (same shape as rules' heading+content), the rest are flat {audio,display}.
type IntroEntry = { audio: string; display: string; content?: { audio: string; display: string }[] }

// Final round (exactly 2 qualified players remain) — see finalRoundCampaignIntro/
// CandidateA/CandidateB in content/content.ts. This total/split MUST match the
// FINAL_ROUND_CAMPAIGN_SECONDS enforced server-side in pages/api/game/[code]/update.ts,
// which is the actual authority for when campaign -> vote fires; these are display-only
// mirrors so the host page can derive its current step from elapsed time without a second
// source of truth for "how long is this round".
const FINAL_ROUND_CAMPAIGN_SECONDS = 120
const FINAL_ROUND_CANDIDATE_SPLIT_SECONDS = 60
// How long the "only two candidates remain..." intro block holds, gated by elapsed seconds
// (not a local wall-clock timer, so a refresh mid-hold still resolves to the same step)
// before the view advances to candidate A's name reveal. No audio is recorded for these
// lines yet, so this is just a readable pause.
const FINAL_ROUND_INTRO_HOLD_SECONDS = 8

type FinalRoundStep = 'intro' | 'candidateA' | 'candidateB'

export default function HostPage() {
  const router = useRouter()
  const { code } = router.query
  const gameCode = Array.isArray(code) ? code[0] : code
  const [game, setGame] = useState<Game | null>(null)
  const [content, setContent] = useState<ReturnType<typeof getExtendedAnnouncementHostMessages> | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [gameExists, setGameExists] = useState(true)
  const [didLoadAttempted, setDidLoadAttempted] = useState(false)
  const [connected, setConnected] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [hasInitialGameData, setHasInitialGameData] = useState(false)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const socketInitializedRef = useRef(false)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)
  const hasTransitionedRef = useRef(false)
  const [messageIndex, setMessageIndex] = useState(0)
  const [barredPlayerName, setBarredPlayerName] = useState<string | null>(null)
  const [leaderName, setLeaderName] = useState<string>('TBD')
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [qualifiedPlayers, setQualifiedPlayers] = useState<Game['players']>([])
  const [sortedBarredPlayers, setSortedBarredPlayers] = useState<Game['players']>([])
  const [voteProgress, setVoteProgress] = useState<string | null>(null)
  const [winnerName, setWinnerName] = useState<string>('TBD')
  const [winnerPoints, setWinnerPoints] = useState<number>(0)
  const [loserPoints, setLoserPoints] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [latestBarredName, setLatestBarredName] = useState<string | null>(null)
  const [swapCandidateName, setSwapCandidateName] = useState<string | null>(null)
  const [swapResultText, setSwapResultText] = useState<string | null>(null)
  const [swapCountdownSeconds, setSwapCountdownSeconds] = useState(0)
  const [displayedHostMessages, setDisplayedHostMessages] = useState<string[]>(['Loading...'])
  const [displayedMessageIndices, setDisplayedMessageIndices] = useState<number[]>([0])
  const [displayedIsHeading, setDisplayedIsHeading] = useState<boolean[]>([false])
  const [isLeaderRevealed, setIsLeaderRevealed] = useState(false)
  const [isBarredRevealed, setIsBarredRevealed] = useState(false)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const [audioRetryTick, setAudioRetryTick] = useState(0)
  const [audioAmplitude, setAudioAmplitude] = useState<number>(0)
  const [isNarrationPlaying, setIsNarrationPlaying] = useState(false)
  const [showEndGamePopover, setShowEndGamePopover] = useState(false)
  const [codeEventToasts, setCodeEventToasts] = useState<CodeEventToastData[]>([])
  const codeEventToastIdRef = useRef(0)
  // Final-round (2 qualified players) scripted campaign sequence — see the dedicated effects
  // below. finalRoundElapsedSeconds ticks every second off game.electionCycleStartTime;
  // finalRoundDisplayedStep/Visible drive a crossfade toward whatever step that elapsed
  // value currently maps to (so a refresh mid-sequence resumes at the right step instead of
  // restarting at 'intro').
  const [finalRoundElapsedSeconds, setFinalRoundElapsedSeconds] = useState(0)
  const [finalRoundDisplayedStep, setFinalRoundDisplayedStep] = useState<FinalRoundStep | null>(null)
  const [finalRoundStepVisible, setFinalRoundStepVisible] = useState(false)
  const finalRoundTransitionedRef = useRef(false)
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const autoTransitionedStatusRef = useRef<Game['status'] | null>(null)
  // Which (status, executiveDecision) the current `content` state was built for. Needed
  // because getExtendedAnnouncementHostMessages now always returns a fresh object (every
  // status is flattened uniformly), so `content === gameContent[status]` can no longer be
  // used to detect "has content caught up to the current game status yet".
  const contentStatusRef = useRef<{ status: Game['status'] | undefined; executiveDecision: Game['executiveDecision'] | undefined; isTwistRound: boolean } | null>(null)
  // Guards for the barred_swap_chance pause: prevent re-firing 'activate'/'expire' calls on
  // effect re-runs, and prevent scheduling more than one narration-advance once resolved.
  const swapActivateCalledRef = useRef(false)
  const swapExpireCalledRef = useRef(false)
  const swapAdvancedRef = useRef(false)

  // 'intro' sequence state: nav/right/left fade out, music + definition card fade in,
  // narration plays, then a multi-step exit (definition, then noun, then title letters
  // scrambling away except "lucin"), then the remaining entries each fade in/play/fade out,
  // then components fade back in and the game advances to 'rules'.
  const [navVisible, setNavVisible] = useState(true)
  const [rightVisible, setRightVisible] = useState(true)
  const [leftVisible, setLeftVisible] = useState(true)
  const [introMusicReady, setIntroMusicReady] = useState(false)
  const [introOverlayVisible, setIntroOverlayVisible] = useState(false)
  const [introDefinitionVisible, setIntroDefinitionVisible] = useState(true)
  const [introNounVisible, setIntroNounVisible] = useState(true)
  const [introTitleLettersFading, setIntroTitleLettersFading] = useState(false)
  const [introLucinVisible, setIntroLucinVisible] = useState(true)
  const [introEntryZeroVisible, setIntroEntryZeroVisible] = useState(true)
  const [introContinuationText, setIntroContinuationText] = useState<string | null>(null)
  const [introContinuationVisible, setIntroContinuationVisible] = useState(false)

  const introEntries = introductionAnnouncementExtension as IntroEntry[]
  const introTitleEntry = introEntries[0]
  const introNounEntry = introTitleEntry?.content?.[0]
  const introDefinitionEntry = introTitleEntry?.content?.[1]
  const introTitleText = introTitleEntry?.display ?? ''
  const introLucinStart = introTitleText.toLowerCase().indexOf('lucin')
  // Stable per-letter random fade delays (recomputed only if the title text changes),
  // so re-renders during the sequence don't reshuffle which letter fades when.
  const introLetterFadeDelays = useMemo(() => {
    return introTitleText.split('').map((_, i) => {
      const isKept = introLucinStart !== -1 && i >= introLucinStart && i < introLucinStart + 5
      if (isKept) return null
      return Math.random() * Math.max(0, INTRO_LETTER_SCRAMBLE_MS - INTRO_LETTER_FADE_MS)
    })
  }, [introTitleText, introLucinStart])

  // Final round (2 qualified players) derived state. Candidate ordering is game.players
  // array order among currently-qualified players (stable join/roster order, same ordering
  // Right already renders qualified players in) — the first qualified player is "candidate
  // A", the second is "candidate B". Recomputed from game.players directly (not the
  // qualifiedPlayers state set by a later effect) so it's correct on the very first render
  // after entering 'campaign', with no one-render lag.
  const finalRoundQualifiedPlayers = useMemo(
    () => (game?.players ?? []).filter(p => p.isQualified),
    [game?.players]
  )
  const isFinalRoundCampaign = game?.status === 'campaign' && finalRoundQualifiedPlayers.length === 2
  const finalRoundCandidateAName = finalRoundQualifiedPlayers[0]?.name ?? 'TBD'
  const finalRoundCandidateBName = finalRoundQualifiedPlayers[1]?.name ?? 'TBD'
  const finalRoundTargetStep: FinalRoundStep | null = !isFinalRoundCampaign
    ? null
    : finalRoundElapsedSeconds < FINAL_ROUND_INTRO_HOLD_SECONDS
      ? 'intro'
      : finalRoundElapsedSeconds < FINAL_ROUND_CANDIDATE_SPLIT_SECONDS
        ? 'candidateA'
        : 'candidateB'
  const finalRoundCandidateASecondsRemaining = Math.max(0, FINAL_ROUND_CANDIDATE_SPLIT_SECONDS - finalRoundElapsedSeconds)
  const finalRoundCandidateACountdownDisplay = `${Math.floor(finalRoundCandidateASecondsRemaining / 60)}:${(finalRoundCandidateASecondsRemaining % 60).toString().padStart(2, '0')}`
  const finalRoundCandidateBSecondsRemaining = Math.max(0, FINAL_ROUND_CAMPAIGN_SECONDS - finalRoundElapsedSeconds)
  const finalRoundCandidateBCountdownDisplay = `${Math.floor(finalRoundCandidateBSecondsRemaining / 60)}:${(finalRoundCandidateBSecondsRemaining % 60).toString().padStart(2, '0')}`

  // One-time barred-candidate-twist round (see game.activeTwistRound doc in
  // types/types.ts) — equality against currentRound, not a live qualified-count check,
  // matching how the server (vote.ts / buildPlayerProjection) identifies the twist round.
  // Only meaningful while game.status === 'vote'; harmless (and false) otherwise.
  const isTwistRound = Boolean(
    game
    && game.activeTwistRound !== undefined
    && game.activeTwistRound === game.currentRound
  )

  const handleTransition = useCallback(async () => {
    if (!gameCode) return
    try {
      await updateGame(gameCode);
    } catch (error) {
      console.error('Error transitioning:', error)
    }
  }, [gameCode])

  // Music for 'intro' shouldn't start until the fade-out sequence below marks it ready —
  // feed useStatusMusic a status of undefined (= no music) until then, otherwise it would
  // start playing the instant game.status flips to 'intro', before anything's even hidden.
  const musicStatus = game?.status === 'intro' && !introMusicReady ? undefined : game?.status
  useStatusMusic(musicStatus, isNarrationPlaying)

  // socket connection and game state management
  useEffect(() => {
    if (!gameCode || !gameExists || !hasInitialGameData) return
    if (socketInitializedRef.current) return

    socketInitializedRef.current = true

    if (!socket) {
      socket = io()
    }

    const handleConnect = () => {
      console.log('Socket connected')
      setConnected(true)

      // Re-subscribe on every successful connect (initial + reconnect)
      socket?.emit('subscribe-to-host', gameCode)
      setIsSubscribed(true)
    }

    const handleDisconnect = () => {
      console.log('Socket disconnected')
      setConnected(false)
      setIsSubscribed(false)
    }

    const handleConnectError = (error: Error) => {
      console.error('Socket connect_error:', error)
      console.log(error?.message ?? 'Connection error: handleConnectError')
    }

    const handleError = (message: unknown) => {
      console.error('Socket error:', message)
      console.log(typeof message === 'string' ? message : 'Socket error: handleError')
    }

    const handleGameStateUpdate = (data: Game) => {
      console.log('Game state update received:', data)
      setGame(data)
      setLoadError(null)

      if (data.currentBarredPlayerIds && data.currentBarredPlayerIds.length > 0) {
        // Keep the primary barred player (leader's direct choice) for {PLAYER_NAME}.
        const primaryBarredId = data.currentBarredPlayerIds[0]
        const barredPlayer = data.players.find(p => p.id === primaryBarredId)
        setBarredPlayerName(barredPlayer?.name ?? null)
      } else {
        setBarredPlayerName(null)
      }
    }

    const handleGameComplete = (data: { winner: { id: string, name: string, votes: number } | null }) => {
      console.log('Game complete:', data)
      setGame(prev => {
        if (!prev) return null
        return {
          ...prev,
          winner: data.winner?.id || prev.winner
        }
      })
    }

    const handleGameDeleted = () => {
      console.log('Game deleted')
      socket?.disconnect()
      socket = null
      router.push('/')
    }

    // Non-blocking banner for the bar_leader / grant_immunity / immunity code effects (see
    // pages/api/game/[code]/redeem-code.ts) — never gated behind the narration/reveal
    // sequence, doesn't touch messageIndex/campaign timer state at all. Stays up for the rest
    // of the current campaign cycle (cleared by the campaign-entry effect below), rather than
    // auto-dismissing on a fixed timer.
    const handleCampaignCodeEvent = (data: { type: 'bar_leader' | 'grant_immunity' | 'immunity'; playerName: string }) => {
      const lines: [string, string, string] = data.type === 'bar_leader'
        ? ['Your leader entered a code.', 'As a result this player is...', '...barred']
        : [`${data.playerName} entered a code.`, 'As a result this player is...', '...provided immunity this round from being barred']

      const id = ++codeEventToastIdRef.current
      setCodeEventToasts(prev => [...prev, { id, lines }])
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('error', handleError)
    socket.on('game-state-update', handleGameStateUpdate)
    socket.on('game-complete', handleGameComplete)
    socket.on('game-deleted', handleGameDeleted)
    socket.on('campaign-code-event', handleCampaignCodeEvent)

    // If socket is already connected (e.g., after page refresh), trigger handleConnect
    if (socket.connected) {
      console.log('[Socket] Already connected on mount, subscribing to game')
      handleConnect()
    } else {
      console.log('[Socket] Not connected on mount, waiting for connect event')
    }

    return () => {
      if (!socket) return
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('error', handleError)
      socket.off('game-state-update', handleGameStateUpdate)
      socket.off('game-complete', handleGameComplete)
      socket.off('game-deleted', handleGameDeleted)
      socket.off('campaign-code-event', handleCampaignCodeEvent)
      socketInitializedRef.current = false
    }
  }, [gameCode, gameExists, hasInitialGameData, router])

  useEffect(() => {
    if (!gameCode || game || didLoadAttempted) return

    console.log('[Host] Fetching initial game state for code:', gameCode)
    setDidLoadAttempted(true)
    setLoadError(null)
    fetch(`/api/game/${gameCode}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) {
          if (res.status === 404) {
            setGameExists(false)
            setIsLoading(false)
            return null
          }
          const message = 'Failed to load game'
          throw new Error(message)
        }
        return res.json()
      })
      .then(data => {
        if (!data) return
        console.log('Fetched initial game data:', data)
        setLoadError(null)
        setGameExists(true)
        setGame(data)
        setHasInitialGameData(true)
      })
      .catch(err => {
        console.error('Error fetching game:', err)
        const message = err instanceof Error ? err.message : 'Unable to fetch game'
        setLoadError(message)
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
        }
        retryTimeoutRef.current = setTimeout(() => {
          setDidLoadAttempted(false)
        }, 10000)
      })

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [gameCode, game, didLoadAttempted])

  // Reset initial data flag when game code changes
  useEffect(() => {
    setHasInitialGameData(false)
  }, [gameCode])

  useEffect(() => {
    const hasLoadedCurrentStatusContent = Boolean(
      contentStatusRef.current
      && contentStatusRef.current.status === game?.status
      && contentStatusRef.current.executiveDecision === game?.executiveDecision
      && contentStatusRef.current.isTwistRound === isTwistRound
    )
    const hasReachedLastMessage = hasLoadedCurrentStatusContent
      && Array.isArray(content?.hostMessage)
      && messageIndex >= content.hostMessage.length - 1

    setIsLeaderRevealed(
      (game?.status === 'results' || game?.status === 'final') ? hasReachedLastMessage : true
    )

    // isBarredRevealed fires when the FIRST (primary) barred name message is reached — this
    // is unaffected by which executive decision (if any) the leader chose, since the base
    // bar happens every round regardless.
    const originalAnnouncementLength = gameContent.announcement.hostMessage.length
    const hasReachedFirstBarredMessage = hasLoadedCurrentStatusContent
      && Array.isArray(content?.hostMessage)
      && messageIndex >= originalAnnouncementLength - 1
    setIsBarredRevealed(
      game?.status === 'announcement' && hasReachedFirstBarredMessage
    )
  }, [game?.status, game?.executiveDecision, isTwistRound, content?.hostMessage, messageIndex])

  // Keep display values in state so UI updates immediately from live game updates.
  useEffect(() => {
    const nextPlayers = game?.players ?? []
    const currentRoundBarredIds = game?.currentBarredPlayerIds ?? game?.rounds?.[game?.currentRound ?? 0]?.barred ?? []
    const isAnnouncementStatus = game?.status === 'announcement'

    // Primary barred player: stays in qualified list until isBarredRevealed. (The
    // barred_swap_chance candidate needs no equivalent hiding — they were already publicly
    // barred in a prior round; only WHICH one was picked, and the swap outcome, are gated,
    // and both of those are driven directly by narration timing / swapWindow.status below,
    // not by hiding them from these lists.)
    const primaryBarredId = game?.currentBarredPlayerIds?.[0] ?? null

    const isCurrentRoundBarredPlayer = (playerId: string) => currentRoundBarredIds.includes(playerId)
    const shouldHideAsBarred = (playerId: string): boolean => {
      if (!isAnnouncementStatus) return false
      if (playerId === primaryBarredId && !isBarredRevealed) return true
      return false
    }

    // Twist round mirror image of shouldHideAsBarred above: the twist winner's
    // isQualified flips to true server-side the instant votes resolve (see vote.ts), well
    // before Lucin's "your elected leader is..." narration reaches their name — without
    // this, they'd visibly jump from the barred panel to the qualified panel the moment
    // 'results' starts, leaking the winner's identity ahead of the reveal gate. Keep them
    // displayed as barred until isLeaderRevealed flips true (same trigger the leader-glow
    // highlight already waits on). Only relevant during 'results' — the twist never reaches
    // 'final', and by 'decision' the reveal has already completed (isLeaderRevealed defaults
    // true for any status other than results/final).
    const twistWinnerId = (isTwistRound && game?.status === 'results')
      ? (nextPlayers.find(p => p.leader)?.id ?? null)
      : null
    const shouldHideTwistWinnerAsQualified = (playerId: string): boolean =>
      Boolean(twistWinnerId && playerId === twistWinnerId && !isLeaderRevealed)

    const nextQualifiedPlayers = nextPlayers.filter(p =>
      (p.isQualified && !shouldHideTwistWinnerAsQualified(p.id))
      || (isCurrentRoundBarredPlayer(p.id) && shouldHideAsBarred(p.id))
    )
    const nextBarredPlayers = nextPlayers.filter(p =>
      (!p.isQualified && !shouldHideAsBarred(p.id))
      || shouldHideTwistWinnerAsQualified(p.id)
    )
    const nextSortedBarredPlayers = [...nextBarredPlayers].sort((a, b) => {
      const aRoundIndex = game?.rounds?.findIndex(round => round?.barred?.includes(a.id)) ?? -1
      const bRoundIndex = game?.rounds?.findIndex(round => round?.barred?.includes(b.id)) ?? -1
      if (aRoundIndex === -1 && bRoundIndex === -1) return 0
      return bRoundIndex - aRoundIndex
    })

    const nextWinner = game?.winner ? nextPlayers.find(p => p.id === game.winner) : null
    const nextWinnerName = nextWinner?.name || 'TBD'
    const nextWinnerPoints = nextWinner?.votes || 0
    const nextLoserPoints = nextPlayers
      .filter(p => p.isQualified && p.id !== game?.winner)
      .reduce((max, p) => Math.max(max, p.votes), 0)

    const nextLeaderName = nextPlayers.find(p => p.leader)?.name || 'TBD'
    const votedCount = nextQualifiedPlayers.filter(p => p.hasVoted).length
    const totalQualified = nextQualifiedPlayers.length
    const nextVoteProgress = game?.status === 'vote' ? `${votedCount}/${totalQualified}` : null

    // Derive the barred_swap_chance candidate's name (revealed only once narration reaches
    // the {SWAP_CANDIDATE_NAME} line — see formatHostMessage token replacement) and, once
    // the 25s window resolves/expires, the outcome sentence for {SWAP_RESULT}.
    const swapWindow = game?.swapWindow
    const nextSwapCandidate = swapWindow ? nextPlayers.find(p => p.id === swapWindow.barredPlayerId) : null
    setSwapCandidateName(nextSwapCandidate?.name ?? null)

    if (swapWindow?.status === 'resolved' && swapWindow.resultQualifiedTargetId) {
      const swappedInTarget = nextPlayers.find(p => p.id === swapWindow.resultQualifiedTargetId)
      setSwapResultText(
        `${nextSwapCandidate?.name ?? 'They'} is qualified again, and ${swappedInTarget?.name ?? 'their replacement'} has been barred instead.`
      )
    } else if (swapWindow?.status === 'expired') {
      setSwapResultText(`${nextSwapCandidate?.name ?? 'They'} remains barred.`)
    } else {
      setSwapResultText(null)
    }

    let nextTimeRemaining = ''
    if (game?.status === 'campaign' && remainingSeconds > 0) {
      const minutes = Math.floor(remainingSeconds / 60)
      const seconds = remainingSeconds % 60
      nextTimeRemaining = `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    setLeaderName(nextLeaderName)
    setTimeRemaining(nextTimeRemaining)
    setQualifiedPlayers(nextQualifiedPlayers)
    setSortedBarredPlayers(nextSortedBarredPlayers)
    setVoteProgress(nextVoteProgress)
    setWinnerName(nextWinnerName)
    setWinnerPoints(nextWinnerPoints)
    setLoserPoints(nextLoserPoints)
  }, [game, remainingSeconds, isBarredRevealed, isLeaderRevealed, isTwistRound])

  useEffect(() => {
    setIsLoading(!game)
  }, [game])

  useEffect(() => {
    setLatestBarredName(barredPlayerName)
  }, [barredPlayerName])

  // Keep host screen resilient against TV/browser sleep/wake cycles
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Host screen hidden, TV likely sleeping or backgrounded')
        return
      }

      console.log('Host screen visible again, checking socket status')
      if (socket) {
        if (!socket.connected) {
          console.log('reconnecting socket...')
          socket.connect()
        }
        if (socket.connected && gameCode && !isSubscribed) {
          socket.emit('subscribe-to-host', gameCode)
          setIsSubscribed(true)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [gameCode, isSubscribed])

  // Update host messages based on game status; extend announcement for the leader's chosen
  // executive decision (immunity_code / requalify_code / barred_swap_chance), or extend
  // vote for the one-time barred-candidate-twist round.
  useEffect(() => {
    if (game?.status) {
      const gameStatus = game.status as keyof typeof gameContent
      setContent(getExtendedAnnouncementHostMessages(gameStatus, game.executiveDecision, isTwistRound))
      contentStatusRef.current = { status: game.status, executiveDecision: game.executiveDecision, isTwistRound }
      setMessageIndex(0)
    }
  }, [game?.status, game?.executiveDecision, isTwistRound])

  // True while the narration is sitting on the barred_swap_chance pause marker — this is
  // the ONE case where the generic auto-advancing narration effect below must stand down
  // entirely; the dedicated swap-window effects further down drive activation, the live
  // countdown, and advancing past this index once the window resolves/expires.
  const isAtSwapWindowMarker = Boolean(
    game?.status === 'announcement'
    && game?.executiveDecision === 'barred_swap_chance'
    && Array.isArray(content?.hostMessage)
    && messageIndex < content.hostMessage.length
    && getHostMessageDisplayText(content.hostMessage[messageIndex] as HostMessageEntry) === '{SWAP_WINDOW}'
  )

  // Play narration for each indexed host message and resolve after the segment delay.
  useEffect(() => {
    if (!game?.status || !Array.isArray(content?.hostMessage) || messageIndex >= content.hostMessage.length) return
    if (isAtSwapWindowMarker) return
    // Final round (2 qualified players): the scripted candidate-speech sequence fully
    // replaces the generic campaign narration/countdown (which would otherwise try to speak
    // "Time until next election."), so stand down entirely — see the dedicated effects
    // below.
    if (isFinalRoundCampaign) return

    const segment = getHostNarrationSegment(game.status, messageIndex, game.executiveDecision, isTwistRound)
    const delayMs = segment?.pauseAfterMs ?? DEFAULT_HOST_PAUSE_MS
    const isLastMessage = messageIndex >= content.hostMessage.length - 1
    const shouldAutoTransition = AUTO_TRANSITION_STATUSES.includes(game.status)

    let isCancelled = false
    let fallbackTimeout: ReturnType<typeof setTimeout> | null = null

    const resolveSegment = () => {
      fallbackTimeout = setTimeout(() => {
        if (isCancelled) return

        if (!isLastMessage) {
          setMessageIndex(prev => prev + 1)
          return
        }

        if (!shouldAutoTransition) return
        if (autoTransitionedStatusRef.current === game.status) return

        autoTransitionedStatusRef.current = game.status
        handleTransition()
      }, delayMs)
    }

    if (narrationAudioRef.current) {
      narrationAudioRef.current.pause()
      narrationAudioRef.current = null
    }

    if (!segment?.audioUrl || segment.hasDynamicTokens) {
      setIsNarrationPlaying(false)
      setAutoplayBlocked(false)
      resolveSegment()

      return () => {
        isCancelled = true
        if (fallbackTimeout) clearTimeout(fallbackTimeout)
      }
    }

    const audio = new Audio(segment.audioUrl)
    narrationAudioRef.current = audio
    audio.preload = 'auto'
    audio.crossOrigin = 'anonymous'
    setAutoplayBlocked(false)

    // Set up Web Audio API for volume analysis
    const setupAudioAnalysis = () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        }
        
        const audioContext = audioContextRef.current
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.6
        analyserRef.current = analyser

        const source = audioContext.createMediaElementSource(audio)
        source.connect(analyser)
        analyser.connect(audioContext.destination)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        
        const updateAmplitude = () => {
          if (isCancelled) return
          
          analyser.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
          // Moderate amplitude response with a power curve
          const normalizedAmplitude = Math.pow(average / 255, 0.85)
          setAudioAmplitude(normalizedAmplitude)
          
          animationFrameRef.current = requestAnimationFrame(updateAmplitude)
        }
        
        updateAmplitude()
      } catch (error) {
        console.warn('Audio analysis setup failed:', error)
      }
    }

    const handleEnded = () => {
      if (isCancelled) return
      setIsNarrationPlaying(false)
      setAudioAmplitude(0)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      resolveSegment()
    }

    const handleError = () => {
      if (isCancelled) return
      setIsNarrationPlaying(false)
      setAudioAmplitude(0)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      resolveSegment()
    }

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('canplay', setupAudioAnalysis, { once: true })

    audio.play().catch((error: unknown) => {
      const err = error as { name?: string }
      if (err?.name === 'NotAllowedError') {
        setIsNarrationPlaying(false)
        setAutoplayBlocked(true)
        console.log('Browser blocked autoplay. Audio will auto-retry on the next user interaction.')
        resolveSegment()
        return
      }
      handleError()
    })
    setIsNarrationPlaying(true)

    return () => {
      isCancelled = true
      audio.pause()
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      if (fallbackTimeout) clearTimeout(fallbackTimeout)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      setIsNarrationPlaying(false)
      setAudioAmplitude(0)
      if (narrationAudioRef.current === audio) {
        narrationAudioRef.current = null
      }
    }
  }, [game?.status, content?.hostMessage, messageIndex, audioRetryTick, handleTransition, isAtSwapWindowMarker, isFinalRoundCampaign, isTwistRound])

  useEffect(() => {
    if (!autoplayBlocked) return

    const retryPlayback = () => {
      setAutoplayBlocked(false)
      setAudioRetryTick(prev => prev + 1)
    }

    document.addEventListener('pointerdown', retryPlayback)
    document.addEventListener('keydown', retryPlayback)
    document.addEventListener('touchstart', retryPlayback)

    return () => {
      document.removeEventListener('pointerdown', retryPlayback)
      document.removeEventListener('keydown', retryPlayback)
      document.removeEventListener('touchstart', retryPlayback)
    }
  }, [autoplayBlocked])

  useEffect(() => {
    if (loadError) {
      setDisplayedHostMessages([loadError])
      setDisplayedMessageIndices([0])
      setDisplayedIsHeading([false])
      return
    }

    if (isLoading) {
      setDisplayedHostMessages(['Loading...'])
      setDisplayedMessageIndices([0])
      setDisplayedIsHeading([false])
      return
    }

    if (!content?.hostMessage) {
      setDisplayedHostMessages(['Waiting...'])
      setDisplayedMessageIndices([0])
      setDisplayedIsHeading([false])
      return
    }

    if (Array.isArray(content.hostMessage)) {
      const hostMessageEntries = content.hostMessage as HostMessageEntry[]

      // Find the most recent heading and only show from there — applies uniformly to
      // every status now (every status uses the same {id,audio,display,content?} shape).
      // It's a no-op for statuses with no headings (startIndex just stays 0, i.e. show
      // everything from the start, same as before). isHeading is structural (derived from
      // nested `content` in content.ts), not text-sniffed, so it's correct regardless of a
      // heading's wording.
      let startIndex = 0
      for (let i = messageIndex; i >= 0; i--) {
        const entry = hostMessageEntries[i]
        if (entry !== undefined && isHostMessageHeading(entry)) {
          startIndex = i
          break
        }
      }

      const slice = hostMessageEntries.slice(startIndex, messageIndex + 1)

      // {SWAP_WINDOW} is a structural pause marker (see barredSwapAnnouncementExtension in
      // content/content.ts) — it's never displayed as text; the live countdown is rendered
      // separately (see the swap-window overlay in the JSX below).
      const sliceWithIndex = slice
        .map((entry, i) => ({ entry, originalIndex: startIndex + i }))
        .filter(({ entry }) => getHostMessageDisplayText(entry) !== '{SWAP_WINDOW}')

      const messages = sliceWithIndex.map(({ entry }) =>
        getHostMessageDisplayText(entry)
          .replace('{LEADER_NAME}', leaderName || 'TBD')
          .replace('{PLAYER_NAME}', latestBarredName || 'TBD')
          .replace('{SWAP_CANDIDATE_NAME}', swapCandidateName || 'TBD')
          .replace('{SWAP_RESULT}', swapResultText || '')
          .replace('{TIME}', timeRemaining || 'TBD')
          .replace('{VOTE_PROGRESS}', voteProgress || '0/0')
          .replace('{WINNER_NAME}', winnerName)
          .replace('{WINNER_POINTS}', winnerPoints.toString())
          .replace('{LOSER_POINTS}', loserPoints.toString())
      )
      const headingFlags = sliceWithIndex.map(({ entry }) => isHostMessageHeading(entry))
      const indices = sliceWithIndex.map(({ originalIndex }) => originalIndex)
      setDisplayedHostMessages(messages)
      setDisplayedMessageIndices(indices)
      setDisplayedIsHeading(headingFlags)
    }
  }, [
    game?.status,
    loadError,
    isLoading,
    content,
    messageIndex,
    leaderName,
    latestBarredName,
    swapCandidateName,
    swapResultText,
    timeRemaining,
    voteProgress,
    winnerName,
    winnerPoints,
    loserPoints
  ])

  // Update remaining seconds for campaign timer. Final round (2 qualified players) is
  // excluded entirely — its display/timer is fully replaced by the scripted candidate-speech
  // sequence below, which owns its own elapsed clock and backup auto-transition (against a
  // fixed 120s, not game.cycleTime). Every other round is unaffected.
  useEffect(() => {
    if (game?.status !== 'campaign' || !game.electionCycleStartTime || !game.cycleTime || isFinalRoundCampaign) {
      setRemainingSeconds(0)
      return
    }

    const updateRemaining = () => {
      const elapsed = Math.floor((Date.now() - game.electionCycleStartTime) / 1000)
      const remaining = Math.max(0, game.cycleTime - elapsed)
      setRemainingSeconds(remaining)
      if (remaining <= 0 && !hasTransitionedRef.current) {
        hasTransitionedRef.current = true
        console.log('Campaign timer expired, auto-transitioning to vote')
        handleTransition()
      }
    }

    updateRemaining()
    const interval = setInterval(updateRemaining, 1000)
    return () => clearInterval(interval)
  }, [game?.status, game?.electionCycleStartTime, game?.cycleTime, handleTransition, isFinalRoundCampaign])

  // Reset transition flags when phase changes
  useEffect(() => {
    if (game?.status === 'campaign') {
      hasTransitionedRef.current = false
    }

    autoTransitionedStatusRef.current = null
  }, [game?.status])

  // Code-event toasts (bar_leader/grant_immunity/immunity reveals) are meant to stay up for
  // "the rest of that campaign time" — clear them the instant the game leaves Campaign, and
  // again on the way into a fresh Campaign cycle, so nothing lingers from a prior round.
  useEffect(() => {
    setCodeEventToasts([])
  }, [game?.status])

  // Final round (2 qualified players): server-authoritative elapsed clock, ticked every
  // second off game.electionCycleStartTime (the same field every other campaign round's
  // timer already uses) rather than a fresh local timer — this is what lets a host page
  // refresh mid-sequence resume at the correct step instead of restarting. Also owns the
  // backup client-side auto-transition to 'vote' at FINAL_ROUND_CAMPAIGN_SECONDS, mirroring
  // the pattern of the normal-round remainingSeconds effect above (the real enforcement is
  // server-side in update.ts; this is just so the host doesn't sit waiting on a stale poll).
  useEffect(() => {
    if (!isFinalRoundCampaign || !game?.electionCycleStartTime) {
      setFinalRoundElapsedSeconds(0)
      finalRoundTransitionedRef.current = false
      return
    }

    const tick = () => {
      const elapsed = Math.floor((Date.now() - game.electionCycleStartTime) / 1000)
      setFinalRoundElapsedSeconds(elapsed)
      if (elapsed >= FINAL_ROUND_CAMPAIGN_SECONDS && !finalRoundTransitionedRef.current) {
        finalRoundTransitionedRef.current = true
        handleTransition()
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isFinalRoundCampaign, game?.electionCycleStartTime, handleTransition])

  // Final round: crossfade the displayed step toward finalRoundTargetStep (derived above
  // from the elapsed clock). The very first step of a fresh round — or the step resolved
  // immediately on a mid-sequence refresh — shows with no fade-in; only step-to-step
  // ADVANCES fade out then in, using the same INTRO_TEXT_FADE_MS timing as the 'intro'
  // sequence for consistency.
  useEffect(() => {
    if (!isFinalRoundCampaign) {
      setFinalRoundDisplayedStep(null)
      setFinalRoundStepVisible(false)
      return
    }
    if (finalRoundTargetStep === null) return

    if (finalRoundDisplayedStep === null) {
      setFinalRoundDisplayedStep(finalRoundTargetStep)
      setFinalRoundStepVisible(true)
      return
    }

    if (finalRoundTargetStep === finalRoundDisplayedStep) return

    let isCancelled = false
    setFinalRoundStepVisible(false)
    const timeout = setTimeout(() => {
      if (isCancelled) return
      setFinalRoundDisplayedStep(finalRoundTargetStep)
      setFinalRoundStepVisible(true)
    }, INTRO_TEXT_FADE_MS)

    return () => {
      isCancelled = true
      clearTimeout(timeout)
    }
  }, [isFinalRoundCampaign, finalRoundTargetStep, finalRoundDisplayedStep])

  // Final round: play each displayed step's narration once, in order, with the same
  // INTRO_AUDIO_GAP_MS gap the 'intro' sequence uses between clips. Fire-and-forget — unlike
  // 'intro', playback does NOT gate the visual step transitions (those are elapsed-time-
  // driven, above); this effect just narrates whichever step is currently on screen.
  // {FINAL_CANDIDATE_NAME} lines have no recorded audio (dynamic per round) and are skipped.
  useEffect(() => {
    if (!isFinalRoundCampaign || !finalRoundDisplayedStep) return

    const stepEntries = finalRoundDisplayedStep === 'intro'
      ? finalRoundCampaignIntro
      : finalRoundDisplayedStep === 'candidateA'
        ? finalRoundCampaignCandidateA
        : finalRoundCampaignCandidateB

    let isCancelled = false
    const pendingTimeouts: ReturnType<typeof setTimeout>[] = []
    const pendingAudios: HTMLAudioElement[] = []

    const wait = (ms: number) => new Promise<void>(resolve => {
      pendingTimeouts.push(setTimeout(resolve, ms))
    })

    const playClip = (url: string) => new Promise<void>(resolve => {
      const audio = new Audio(url)
      pendingAudios.push(audio)
      audio.crossOrigin = 'anonymous'
      audio.addEventListener('ended', () => resolve(), { once: true })
      audio.addEventListener('error', () => resolve(), { once: true })
      audio.play().catch(() => resolve())
    })

    const run = async () => {
      for (let i = 0; i < stepEntries.length; i++) {
        if (isCancelled) return
        const entry = stepEntries[i]
        if (!isDynamicTokenLine(entry.audio)) {
          const audioUrl = getAudioUrlForText(entry.audio)
          if (audioUrl) await playClip(audioUrl)
          if (isCancelled) return
        }
        const isLast = i === stepEntries.length - 1
        if (!isLast) await wait(INTRO_AUDIO_GAP_MS)
      }
    }

    run()

    return () => {
      isCancelled = true
      pendingTimeouts.forEach(clearTimeout)
      pendingAudios.forEach(audio => audio.pause())
    }
  }, [isFinalRoundCampaign, finalRoundDisplayedStep])

  // Reset the swap-window guards whenever narration moves off the pause marker (e.g. a new
  // round with a fresh barred_swap_chance decision reaches it again).
  useEffect(() => {
    if (!isAtSwapWindowMarker) {
      swapActivateCalledRef.current = false
      swapExpireCalledRef.current = false
      swapAdvancedRef.current = false
      setSwapCountdownSeconds(0)
    }
  }, [isAtSwapWindowMarker])

  // The instant narration reaches the pause marker, tell the server to open the 25s window
  // (idempotent — see pages/api/game/[code]/swap.ts). This is what makes the countdown
  // (and the barred player's picker, via their own player projection) real-time.
  useEffect(() => {
    if (!isAtSwapWindowMarker || !gameCode) return
    if (!game?.swapWindow || game.swapWindow.status !== 'pending') return
    if (swapActivateCalledRef.current) return
    swapActivateCalledRef.current = true

    fetch(`/api/game/${gameCode}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate' }),
    }).catch(err => console.error('Failed to activate swap window:', err))
  }, [isAtSwapWindowMarker, game?.swapWindow?.status, gameCode])

  // Live countdown display, driven by the server-set deadline (not a local 25s timer) —
  // and once local time is up, tell the server to expire the window. 'resolve' independently
  // re-validates the deadline server-side, so this call is a formality that keeps the
  // announcement moving, not the actual enforcement.
  useEffect(() => {
    const deadline = game?.swapWindow?.deadline
    if (!isAtSwapWindowMarker || game?.swapWindow?.status !== 'active' || !deadline || !gameCode) {
      setSwapCountdownSeconds(0)
      return
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setSwapCountdownSeconds(remaining)
      if (remaining <= 0 && !swapExpireCalledRef.current) {
        swapExpireCalledRef.current = true
        fetch(`/api/game/${gameCode}/swap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'expire' }),
        }).catch(err => console.error('Failed to expire swap window:', err))
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isAtSwapWindowMarker, game?.swapWindow?.status, game?.swapWindow?.deadline, gameCode])

  // Once the window resolves (early submission) or expires (timeout), continue the
  // announcement narration to the {SWAP_RESULT} line — a short buffer lets the live
  // qualified/barred lists (which already reflect the real mutation, applied server-side
  // the instant it happened) settle before the narration text catches up.
  useEffect(() => {
    const status = game?.swapWindow?.status
    if (!isAtSwapWindowMarker || (status !== 'resolved' && status !== 'expired')) return
    if (swapAdvancedRef.current) return
    swapAdvancedRef.current = true

    const timeout = setTimeout(() => {
      setMessageIndex(prev => prev + 1)
    }, 1500)
    return () => clearTimeout(timeout)
  }, [isAtSwapWindowMarker, game?.swapWindow?.status])

  // 'intro' sequence, run once per entry into the status. Fully self-contained — doesn't
  // touch the generic messageIndex/narration state machine used by every other status.
  useEffect(() => {
    if (game?.status !== 'intro') {
      // Not (or no longer) in intro — make sure everything's in its resting state so a
      // future 'intro' entry starts clean.
      setNavVisible(true)
      setRightVisible(true)
      setLeftVisible(true)
      setIntroMusicReady(false)
      setIntroOverlayVisible(false)
      setIntroDefinitionVisible(true)
      setIntroNounVisible(true)
      setIntroTitleLettersFading(false)
      setIntroLucinVisible(true)
      setIntroEntryZeroVisible(true)
      setIntroContinuationText(null)
      setIntroContinuationVisible(false)
      return
    }

    let isCancelled = false
    const pendingTimeouts: ReturnType<typeof setTimeout>[] = []
    const pendingAudios: HTMLAudioElement[] = []

    const wait = (ms: number) => new Promise<void>(resolve => {
      pendingTimeouts.push(setTimeout(resolve, ms))
    })

    const playClip = (url: string) => new Promise<void>(resolve => {
      const audio = new Audio(url)
      pendingAudios.push(audio)
      audio.crossOrigin = 'anonymous'
      audio.addEventListener('ended', () => resolve(), { once: true })
      audio.addEventListener('error', () => resolve(), { once: true })
      audio.play().catch(() => resolve())
    })

    const run = async () => {
      // 1. Nav fades out, then Right, then Left — ~3s total.
      setNavVisible(false)
      await wait(INTRO_COMPONENT_FADE_MS)
      if (isCancelled) return
      setRightVisible(false)
      await wait(INTRO_COMPONENT_FADE_MS)
      if (isCancelled) return
      setLeftVisible(false)
      await wait(INTRO_COMPONENT_FADE_MS)
      if (isCancelled) return

      // 2. Once fully hidden, start the intro music (music/intro/0).
      setIntroMusicReady(true)

      const entryZero = introEntries[0]
      const nounEntry = entryZero?.content?.[0]
      const definitionEntry = entryZero?.content?.[1]

      // 3. Card (title + noun + definition) fades in together.
      setIntroOverlayVisible(true)
      await wait(INTRO_TEXT_FADE_MS)
      if (isCancelled) return

      // 4. Play title, noun, definition audio in order — 1.5s gap between each (not after the last).
      const entryZeroClips = [entryZero?.audio, nounEntry?.audio, definitionEntry?.audio]
        .filter((text): text is string => Boolean(text))
      for (let i = 0; i < entryZeroClips.length; i++) {
        if (isCancelled) return
        const audioUrl = getAudioUrlForText(entryZeroClips[i])
        if (audioUrl) await playClip(audioUrl)
        if (isCancelled) return
        const isLast = i === entryZeroClips.length - 1
        if (!isLast) await wait(INTRO_AUDIO_GAP_MS)
      }
      if (isCancelled) return

      // 5. Definition fades away, then 'noun' fades away.
      setIntroDefinitionVisible(false)
      await wait(INTRO_TEXT_FADE_MS)
      if (isCancelled) return
      setIntroNounVisible(false)
      await wait(INTRO_TEXT_FADE_MS)
      if (isCancelled) return

      // 6. Title letters fade away at random, except "lucin" — over ~2s.
      setIntroTitleLettersFading(true)
      await wait(INTRO_LETTER_SCRAMBLE_MS)
      if (isCancelled) return

      // 7. 'lucin' alone, visible for 5s, then fades away.
      await wait(INTRO_LUCIN_HOLD_MS)
      if (isCancelled) return
      setIntroLucinVisible(false)
      await wait(INTRO_TEXT_FADE_MS)
      if (isCancelled) return

      // Entry 0 is fully gone — drop it from layout so the continuation line below centers cleanly.
      setIntroEntryZeroVisible(false)

      // 8. Continue through the remaining entries: audio starts the instant the fade-in
      // begins (not after it finishes) — only entry 0's title/noun/definition trio waits
      // for its fade to complete first. A special 5s pause happens before the LAST entry.
      for (let i = 1; i < introEntries.length; i++) {
        if (isCancelled) return
        const entry = introEntries[i]
        const isLastEntry = i === introEntries.length - 1

        if (isLastEntry) {
          await wait(INTRO_FINAL_PAUSE_MS)
          if (isCancelled) return
        }

        setIntroContinuationText(entry.display)
        setIntroContinuationVisible(true)

        const audioUrl = getAudioUrlForText(entry.audio)
        if (audioUrl) await playClip(audioUrl)
        if (isCancelled) return

        setIntroContinuationVisible(false)
        await wait(INTRO_TEXT_FADE_MS)
        if (isCancelled) return
      }

      setIntroOverlayVisible(false)

      // 9. Fade components back in — Left, then Right, then Nav (mirrors fade-out order).
      setLeftVisible(true)
      await wait(INTRO_COMPONENT_FADE_MS)
      if (isCancelled) return
      setRightVisible(true)
      await wait(INTRO_COMPONENT_FADE_MS)
      if (isCancelled) return
      setNavVisible(true)
      await wait(INTRO_COMPONENT_FADE_MS)
      if (isCancelled) return

      // 10. Last component finished fading in — advance to 'rules'.
      handleTransition()
    }

    run()

    return () => {
      isCancelled = true
      pendingTimeouts.forEach(clearTimeout)
      pendingAudios.forEach(audio => audio.pause())
    }
  }, [game?.status, handleTransition])

  const handleEndGame = () => {
    setShowEndGamePopover(true)
  }

  const confirmEndGame = async () => {
    if (!gameCode) return

    try {
      const res = await fetch(`/api/game/${gameCode}/delete`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to end game')
      }
      router.push('/start')
    } catch (error) {
      console.error('Error ending game:', error)
      alert('Failed to end game')
      setShowEndGamePopover(false)
    }
  }

  if (!gameCode) return <div style={{ padding: 24 }}>Loading...</div>

  if (!gameExists) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: 24,
          gap: 16
        }}
      >
        <h2 style={{ color: '#5A5A5A', margin: 0 }}>Game Not Found</h2>
        <p style={{ color: '#999', margin: 0 }}>The game code you're looking for doesn't exist.</p>
        <ButtonLiquid onClick={() => router.push('/start')}>Go to Start</ButtonLiquid>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      {game?.status === 'intro' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: introOverlayVisible ? 1 : 0,
            transition: `opacity ${INTRO_TEXT_FADE_MS}ms ease`,
            pointerEvents: 'none'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: '40%' }}>
            {introEntryZeroVisible && (
              <>
                <Text size={4} color='text-primary' bold style={{ fontFamily: 'inherit' }}>
                  {introTitleText.split('').map((ch, i) => {
                    const delay = introLetterFadeDelays[i]
                    const isKept = delay === null
                    const hidden = isKept ? !introLucinVisible : introTitleLettersFading
                    const transitionMs = isKept ? INTRO_TEXT_FADE_MS : INTRO_LETTER_FADE_MS
                    const transitionDelayMs = isKept ? 0 : (delay ?? 0)
                    return (
                      <span
                        key={i}
                        style={{
                          opacity: hidden ? 0 : 1,
                          transition: `opacity ${transitionMs}ms ease ${transitionDelayMs}ms`
                        }}
                      >
                        {ch}
                      </span>
                    )
                  })}
                </Text>
                <Text
                  size={1.5}
                  color='text-secondary'
                  style={{
                    fontFamily: 'inherit',
                    textAlign: 'justify',
                    opacity: introNounVisible ? 1 : 0,
                    transition: `opacity ${INTRO_TEXT_FADE_MS}ms ease`
                  }}
                >
                  {introNounEntry?.display}
                </Text>
                <div
                  style={{
                    width: '100%',
                    borderBottom: '1px solid var(--color-accent-line)',
                    opacity: introNounVisible ? 1 : 0,
                    transition: `opacity ${INTRO_TEXT_FADE_MS}ms ease`
                  }}
                />
                <Text
                  size={1.75}
                  color='text-primary'
                  style={{
                    fontFamily: 'inherit',
                    textAlign: 'justify',
                    opacity: introDefinitionVisible ? 1 : 0,
                    transition: `opacity ${INTRO_TEXT_FADE_MS}ms ease`
                  }}
                >
                  {introDefinitionEntry?.display}
                </Text>
              </>
            )}
            {introContinuationText && (
              <Text
                size={1.75}
                color='text-primary'
                style={{
                  fontFamily: 'inherit',
                  textAlign: 'justify',
                  opacity: introContinuationVisible ? 1 : 0,
                  transition: `opacity ${INTRO_TEXT_FADE_MS}ms ease`
                }}
              >
                {introContinuationText}
              </Text>
            )}
          </div>
        </div>
      )}
      <div style={{ opacity: navVisible ? 1 : 0, transition: `opacity ${INTRO_COMPONENT_FADE_MS}ms ease` }}>
        <Nav
          gameStatus={game?.status}
          code={gameCode}
          connected={connected}
          qualifiedPlayersCount={game?.players?.filter(player => player.isQualified).length}
          onEndGame={handleEndGame}
        />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          height: '100%',
          marginTop: 24,
          flex: 1
        }}
      >
        {/* Left Half - Lucin and Info */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '70%',
          height: '100%',
          position: 'relative',
          // Campaign gets less top padding than every other status — the countdown needs to
          // sit higher to leave room below for however many code-event/post announcements
          // stack up beneath it over the course of the cycle (see CodeEventToast/PostFeed
          // below).
          paddingTop: game?.status === 'campaign' ? '6%' : '15%',
          opacity: leftVisible ? 1 : 0,
          transition: `opacity ${INTRO_COMPONENT_FADE_MS}ms ease`
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            height: '60%',
            aspectRatio: '1 / 1',
            zIndex: 0,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center'
          }}>
            <Lucin height='100%' amplitude={audioAmplitude}/>
          </div>
          <div style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 8,
            width: '80%'
          }}>
            {isFinalRoundCampaign ? (
              // Final round (2 qualified players): full replacement for the normal
              // campaign narration/countdown view above, not an addition to it — see the
              // dedicated effects driving finalRoundDisplayedStep/Visible.
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  opacity: finalRoundStepVisible ? 1 : 0,
                  transition: `opacity ${INTRO_TEXT_FADE_MS}ms ease`
                }}
              >
                {finalRoundDisplayedStep === 'intro' && finalRoundCampaignIntro.map((line, i) => (
                  <Text key={i} size={1.5} color='text-primary'>{line.display}</Text>
                ))}
                {finalRoundDisplayedStep === 'candidateA' && (
                  <>
                    <Text size={1.5} color='text-primary'>{finalRoundCampaignCandidateA[0]?.display}</Text>
                    <Text size={1.75} color='text-primary' bold>{finalRoundCandidateAName}</Text>
                    <Text size={1.75} color='text-primary' bold>{finalRoundCandidateACountdownDisplay}</Text>
                  </>
                )}
                {finalRoundDisplayedStep === 'candidateB' && (
                  <>
                    <Text size={1.5} color='text-primary'>{finalRoundCampaignCandidateB[0]?.display}</Text>
                    <Text size={1.75} color='text-primary' bold>{finalRoundCandidateBName}</Text>
                    <Text size={1.75} color='text-primary' bold>{finalRoundCandidateBCountdownDisplay}</Text>
                  </>
                )}
              </div>
            ) : (
              <>
                {displayedHostMessages.map((message, index) => {
                  const originalIndex = displayedMessageIndices[index] ?? index
                  const isBold = (displayedIsHeading[index] ?? false)
                    || shouldHostMessageBeBold(game?.status, message, originalIndex, game?.executiveDecision, isTwistRound)
                  return (
                    <Text key={index} size={isBold ? 1.75 : 1.5} color='text-primary' bold={isBold} style={{ marginBottom: index < displayedHostMessages.length - 1 ? '0.5rem' : 0 }}>
                      {formatHostMessage(message, {
                        leaderName,
                        latestBarredName,
                        swapCandidateName,
                        swapResultText,
                        timeRemaining,
                        voteProgress,
                        winnerName,
                        winnerPoints,
                        loserPoints
                      })}
                    </Text>
                  )
                })}
                {isAtSwapWindowMarker && game?.swapWindow?.status === 'active' && (
                  <Text size={1.75} color='text-primary' bold style={{ marginBottom: '0.5rem' }}>
                    {swapCandidateName || 'They'} is deciding... {swapCountdownSeconds}s
                  </Text>
                )}
              </>
            )}
            {loadError ? (
              <p style={{ textAlign: 'center', color: '#E03E3E', marginTop: 12 }}>
                Please refresh or check the game code.
              </p>
            ) : null}
            {game?.status === 'campaign' && <CodeEventToast toasts={codeEventToasts} />}
            {game?.status === 'campaign' && (
              <PostFeed
                posts={(game?.players ?? [])
                  .filter(p => p.influence === 'post' && p.currentPost)
                  .map(p => ({ alias: p.postAlias || 'Anonymous', text: p.currentPost as string }))}
              />
            )}
          </div>
        </div>

        <div style={{ flex: 4, width: '30%', height: '100%', opacity: rightVisible ? 1 : 0, transition: `opacity ${INTRO_COMPONENT_FADE_MS}ms ease` }}>
          <Right
            qualifiedPlayers={qualifiedPlayers}
            sortedBarredPlayers={sortedBarredPlayers}
            gameStatus={game?.status}
            isLeaderRevealed={isLeaderRevealed}
            currentRound={game?.currentRound}
            isTwistRound={isTwistRound}
          />
        </div>
      </div>

      <Popover 
        isOpen={showEndGamePopover} 
        onClose={() => setShowEndGamePopover(false)}
        title="Are you sure you want to end this game?"
        confirmText="Confirm End Game"
        onConfirm={confirmEndGame}
      />
    </div>
  )
}
