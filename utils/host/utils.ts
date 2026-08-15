import type { Game } from '../../types/types'
import { gameContent, immunityCodeAnnouncementExtension, requalifyCodeAnnouncementExtension, barredSwapAnnouncementExtension } from '../../content/content'
import { getHostNarrationSegment, flattenHostMessages } from '../../content/hostNarration'

const SUPPORTED_STATUS_MUSIC = new Set<Game['status']>(['join', 'intro', 'rules', 'campaign', 'vote', 'results', 'decision', 'announcement', 'final'])

export function getStatusMusicUrl(status?: Game['status'] | null) {
	if (!status || !SUPPORTED_STATUS_MUSIC.has(status)) return null
	const base = process.env.NEXT_PUBLIC_AUDIO_OBJECT_BASE_URL?.trim()
	if (!base) return null
	const normalized = base.endsWith('/') ? base.slice(0, -1) : base
	const suffix = process.env.NEXT_PUBLIC_AUDIO_OBJECT_SUFFIX?.trim() || ''
	const key = `music/${status}/0${suffix}`
	return `${normalized}/${key}`
}

export function getJoinMusicUrl() {
	return getStatusMusicUrl('join')
}

// Every status's hostMessage is now the same {id,audio,display,content?} shape, so this
// flattens uniformly for all of them — not just rules. It always returns a NEW object
// (never baseContent as-is), since executive-decision extensions need to be combined with
// the raw entries BEFORE a single flatten pass. Callers must not rely on reference
// equality against gameContent[status] — see the contentStatusRef tracking in
// pages/host/[code].tsx, which exists specifically because of this.
export function getExtendedAnnouncementHostMessages(gameStatus: Game['status'], executiveDecision?: Game['executiveDecision']) {
	const baseContent = gameContent[gameStatus as keyof typeof gameContent]
	const baseEntries = Array.isArray(baseContent?.hostMessage) ? baseContent.hostMessage : []
	const rawEntries: unknown[] = [...baseEntries]

	if (gameStatus === 'announcement') {
		if (executiveDecision === 'immunity_code') rawEntries.push(...immunityCodeAnnouncementExtension)
		else if (executiveDecision === 'requalify_code') rawEntries.push(...requalifyCodeAnnouncementExtension)
		else if (executiveDecision === 'barred_swap_chance') rawEntries.push(...barredSwapAnnouncementExtension)
	}

	return { ...baseContent, hostMessage: flattenHostMessages(rawEntries) }
}

export function formatHostMessage(
	message: string,
	tokens: {
		leaderName?: string | null
		latestBarredName?: string | null
		swapCandidateName?: string | null
		swapResultText?: string | null
		timeRemaining?: string | null
		voteProgress?: string | null
		winnerName?: string | null
		winnerPoints?: number
		loserPoints?: number
	}
) {
	return message
		.replace('{LEADER_NAME}', tokens.leaderName || 'TBD')
		.replace('{PLAYER_NAME}', tokens.latestBarredName || 'TBD')
		.replace('{SWAP_CANDIDATE_NAME}', tokens.swapCandidateName || 'TBD')
		.replace('{SWAP_WINDOW}', '')
		.replace('{SWAP_RESULT}', tokens.swapResultText || '')
		.replace('{TIME}', tokens.timeRemaining || 'TBD')
		.replace('{VOTE_PROGRESS}', tokens.voteProgress || '0/0')
		.replace('{WINNER_NAME}', tokens.winnerName || 'TBD')
		.replace('{WINNER_POINTS}', String(tokens.winnerPoints ?? 0))
		.replace('{LOSER_POINTS}', String(tokens.loserPoints ?? 0))
}

export function shouldHostMessageBeBold(status: Game['status'] | undefined, message: string, originalIndex: number, executiveDecision?: Game['executiveDecision']): boolean {
	if (status === 'join' && originalIndex === 0) return true
	if (message.startsWith('Phase')) return true

	if (status) {
		const segment = getHostNarrationSegment(status, originalIndex, executiveDecision)
		if (segment?.hasDynamicTokens) return true
	}

	return false
}
