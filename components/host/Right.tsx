import { Game } from '../../types/types'
import Text from '../Text'
import CandidateListItem from './CandidateListItem'
import LineBreak from '../LineBreak'

type RightProps = {
	qualifiedPlayers?: Game['players']
	sortedBarredPlayers?: Game['players']
	gameStatus?: Game['status']
}

export default function Right({ qualifiedPlayers = [], sortedBarredPlayers = [], gameStatus }: RightProps = {}) {
	return (
		<div style={{
			display: 'flex',
			flexDirection: 'column',
			flex: 4,
			gap: 12,
			width: '30%',
			height: '100%'
		}}>
            <Text color='text-primary' size={14} allCaps bold>
                Qualified
            </Text>
			<div
				style={{
                    display: 'flex',
					flexDirection: 'column',
					gap: 6,
					width: '100%'
				}}
			>
				{qualifiedPlayers?.length === 0 ? (
					<p style={{ textAlign: 'center', color: '#5A5A5A' }}>
						No players have joined yet
					</p>
				) : (
					qualifiedPlayers.map((player) => (
						<CandidateListItem
							key={player.id}
							player={player}
							showVotes={gameStatus === 'results'}
						/>
					))
				)}
            </div>
            <Text color='text-secondary' size={14} allCaps bold>
                Barred
            </Text>
            <div
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: 6,
					width: '100%'
				}}
			>
                {sortedBarredPlayers.map((player) => (
                    <CandidateListItem
                        key={player.id}
                        player={player}
                        barred
                    />
                ))}
            </div>
		</div>
	)
}
