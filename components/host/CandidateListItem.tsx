import { Player } from '../../types/types'
import Text from '../Text'
import GlassBubble from '../GlassBubble'

type CandidateListItemProps = {
	player: Player
	showVotes?: boolean
	barred?: boolean
	displayVotes?: number
	isLeaderRevealed?: boolean
	currentRound?: number
}

export default function CandidateListItem({ player, showVotes = false, barred = false, displayVotes, isLeaderRevealed = false, currentRound }: CandidateListItemProps) {
	const voteCount = displayVotes ?? player.votes
	const isLeaderGlowing = player.leader && isLeaderRevealed
	const hasImmunity = currentRound !== undefined && player.immuneFromBarInRound === currentRound

	return (
		<GlassBubble style={{ width: '100%', padding: '12px 28px', opacity: barred ? 0.65 : 1 }} contentStyle={{ width: '100%' }} showGlow={isLeaderGlowing}>
			<div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
				<div style={{ flex: '0 1 auto', display: 'flex', gap: '6px', alignItems: 'baseline', minWidth: 0 }}>
					<Text
						size={1}
						color={barred ? 'disabled' : 'accent-line'}
						style={{ textDecoration: barred ? 'line-through' : 'none', textAlign: 'left' }}
					>
						{player.name}
					</Text>
					{player.isAdmin && (
						<Text
							size={0.5}
							color={barred ? 'disabled' : 'accent-line'}
							style={{ fontStyle: 'italic' }}
						>
							admin
						</Text>
					)}
					{hasImmunity && (
						<Text size={0.7} color={barred ? 'disabled' : 'accent-line'} style={{ fontStyle: 'italic' }}>
							Immunity
						</Text>
					)}
				</div>
				{showVotes ? (
					<div style={{ flex: '0 0 auto', display: 'flex', gap: '4px', alignItems: 'baseline' }}>
						{isLeaderGlowing && (
							<Text size={1} color={barred ? 'disabled' : 'accent-line'} style={{ fontStyle: 'italic' }}>
								Leader
							</Text>
						)}
						<Text size={1} color='accent-line'>{isLeaderGlowing ? '✓ ' : ''} {voteCount} pts</Text>
					</div>
				) : null}
			</div>
		</GlassBubble>
	)
}
