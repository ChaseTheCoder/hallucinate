import { Player } from '../../types/types'
import Text from '../Text'
import GlassBubble from '../GlassBubble'

type CandidateListItemProps = {
	player: Player
	showVotes?: boolean
	barred?: boolean
	displayVotes?: number
	isLeaderRevealed?: boolean
}

export default function CandidateListItem({ player, showVotes = false, barred = false, displayVotes, isLeaderRevealed = false }: CandidateListItemProps) {
	const voteCount = displayVotes ?? player.votes
	const isLeaderGlowing = player.leader && isLeaderRevealed

	return (
		<GlassBubble style={{ width: '100%', padding: '12px 28px', opacity: barred ? 0.65 : 1 }} contentStyle={{ width: '100%' }} showGlow={isLeaderGlowing}>
			<div style={{ width: '100%', display: 'flex', justifyContent: 'space-between'}}>
				<div style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
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
				</div>
				{showVotes ? <Text size={1} color={barred ? 'disabled' : 'accent-line'}>{isLeaderGlowing ? '✓ ' : ''} {voteCount} pts</Text> : null}
			</div>
		</GlassBubble>
	)
}
