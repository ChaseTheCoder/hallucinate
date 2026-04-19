import Button from '../../components/Button'
import { Game } from '../../types/types'
import Text from '../../components/Text'

type NavProps = {
	gameStatus?: Game['status']
	code?: string
	connected: boolean
	onEndGame: () => void | Promise<void>
}

export default function Nav({ gameStatus, code, connected, onEndGame }: NavProps) {
    const gameStatusDisplay = ['campaign', 'vote', 'results', 'decision', 'announcement']
	return (
		<>
			<div style={{
				top: 0,
				left: 0,
				right: 0,
				height: 'auto',
				padding: '0 24px',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between'
			}}>
				<div style={{ flexDirection: 'column', display: 'flex', alignItems: 'start', gap: 0 }}>
                    <Text color="text-secondary" size={14} bold allCaps>Code</Text>
                    <Text color="text-primary" size={36} bold>{code || '----'}</Text>
				</div>

                <div style={{ flexDirection: 'row', display: 'flex', alignItems: 'center', gap: 16 }}>
					{gameStatusDisplay.map((status) => (
						<div style={{ padding: '8px 16px', borderRadius: '40px', backgroundColor: gameStatus === status ? 'var(--color-primary)' : 'transparent', boxShadow: gameStatus === status ? 'var(--shadow-soft)' : 'none' }} key={status}>
                            <Text key={status} color={gameStatus === status ? 'surface-white' : 'text-secondary'} size={18} bold allCaps>
                                {status}
                            </Text>
                        </div>
                    ))}
                </div>

				<div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
					{gameStatus ?
                        <Button onClick={onEndGame}>End Game</Button> :
					    <span style={{ fontSize: 16, color: '#5A5A5A', fontWeight: 600, animation: 'pulse 1.5s ease-in-out infinite' }}>
							Loading...
						</span>
					}
				</div>
			</div>
			<style jsx>{`
				@keyframes pulse {
					0% { opacity: 1; }
					50% { opacity: 0.35; }
					100% { opacity: 1; }
				}
			`}</style>
		</>
	)
}
