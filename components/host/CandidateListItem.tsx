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
				<Text
					size={1}
					color={barred ? 'disabled' : 'accent-line'}
					style={{ textDecoration: barred ? 'line-through' : 'none', textAlign: 'left' }}
				>
					{player.name}{player.isAdmin && '*'}
				</Text>
				{showVotes ? <Text size={1} color={barred ? 'disabled' : 'accent-line'}>({voteCount} pts)</Text> : null}
			</div>
		</GlassBubble>
	)
}
