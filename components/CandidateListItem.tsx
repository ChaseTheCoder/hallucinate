import { Player } from '../types/types'
import Text from './Text'

type CandidateListItemProps = {
	player: Player
	showVotes?: boolean
	barred?: boolean
}

export default function CandidateListItem({ player, showVotes = false, barred = false }: CandidateListItemProps) {
	return (
		<div
			style={{
				padding: '12px 28px',
				backgroundColor: barred ? 'transparent' : 'var(--color-white)',
				borderRadius: '40px',
				boxShadow: 'var(--shadow-soft)',
				textAlign: 'center',
				display: 'flex',
				justifyContent: 'space-between'
			}}
		>
			<Text
				size={16}
				color={barred ? 'disabled' : 'accent-line'}
				style={{ textDecoration: barred ? 'line-through' : 'none' }}
			>
				{player.name}{player.isAdmin && '*'}
			</Text>
			{showVotes ? <Text size={16} color={barred ? 'disabled' : 'accent-line'}>({player.votes} pts)</Text> : null}
		</div>
	)
}
