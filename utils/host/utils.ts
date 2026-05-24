import type { Game } from '../../types/types'
import { gameContent, barAnotherAnnouncementExtension, selfImmunityAnnouncementExtension, grantImmunityAnnouncementExtension } from '../../content/content'
import { getHostNarrationSegment } from '../../content/hostNarration'

const SUPPORTED_STATUS_MUSIC = new Set<Game['status']>(['join', 'rules', 'campaign', 'vote', 'results', 'decision', 'announcement', 'final'])

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

export function getExtendedAnnouncementHostMessages(gameStatus: Game['status'], executiveDecision?: Game['executiveDecision']) {
	const baseContent = gameContent[gameStatus as keyof typeof gameContent]
	if (gameStatus !== 'announcement') return baseContent

	if (executiveDecision === 'bar_another') {
		return {
			...baseContent,
			hostMessage: [
				...(baseContent.hostMessage as string[]),
				...barAnotherAnnouncementExtension
			]
		}
	}

	if (executiveDecision === 'self_immunity_next_cycle') {
		return {
			...baseContent,
			hostMessage: [
				...(baseContent.hostMessage as string[]),
				...selfImmunityAnnouncementExtension
			]
		}
	}

	if (executiveDecision === 'grant_immunity_next_cycle') {
		return {
			...baseContent,
			hostMessage: [
				...(baseContent.hostMessage as string[]),
				...grantImmunityAnnouncementExtension
			]
		}
	}

	return baseContent
}

export function formatHostMessage(
	message: string,
	tokens: {
		leaderName?: string | null
		latestBarredName?: string | null
		secondBarredName?: string | null
		grantedImmunityPlayerName?: string | null
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
		.replace('{ED1_PLAYER_NAME}', tokens.secondBarredName || 'TBD')
		.replace('{PLAYER_GRANTED_IMMUNITY}', tokens.grantedImmunityPlayerName || 'TBD')
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
