import { useEffect, useRef, useState } from 'react'
import { Game } from '../../types/types'
import Text from '../Text'
import ButtonLiquid from '../ButtonLiquid'
import GlassBubble from '../GlassBubble'

type NavProps = {
	gameStatus?: Game['status']
	code?: string
	connected: boolean
	onEndGame: () => void | Promise<void>
}

export default function Nav({ gameStatus, code, connected, onEndGame }: NavProps) {
	const gameStatusDisplay: Game['status'][] = ['campaign', 'vote', 'results', 'decision', 'announcement']
	const [displayedStatus, setDisplayedStatus] = useState<Game['status'] | undefined>(gameStatus)
	const [statusPhase, setStatusPhase] = useState<'in' | 'out'>('in')
	const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		if (gameStatus === displayedStatus) return

		if (transitionTimeoutRef.current) {
			clearTimeout(transitionTimeoutRef.current)
		}

		if (!displayedStatus) {
			setDisplayedStatus(gameStatus)
			setStatusPhase('in')
			return
		}

		setStatusPhase('out')
		transitionTimeoutRef.current = setTimeout(() => {
			setDisplayedStatus(gameStatus)
			setStatusPhase('out')
			requestAnimationFrame(() => setStatusPhase('in'))
		}, 220)
	}, [gameStatus, displayedStatus])

	useEffect(() => {
		return () => {
			if (transitionTimeoutRef.current) {
				clearTimeout(transitionTimeoutRef.current)
			}
		}
	}, [])

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
						displayedStatus === status ? (
							<GlassBubble
								key={status}
								style={{
									padding: '8px 16px',
									opacity: statusPhase === 'out' ? 0 : 1,
									transition: 'opacity 220ms ease'
								}}
							>
								<Text color="text-primary" size={18} bold allCaps>
									{status}
								</Text>
							</GlassBubble>
						) : (
							<div style={{ padding: '8px 16px', borderRadius: '40px', backgroundColor: 'transparent', boxShadow: 'none' }} key={status}>
								<Text color="text-secondary" size={18} bold allCaps>
									{status}
								</Text>
							</div>
						)
                    ))}
                </div>

				<div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
					{gameStatus ?
                        <ButtonLiquid onClick={onEndGame}>End Game</ButtonLiquid> :
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
