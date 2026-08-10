import { useEffect, useRef, useState } from 'react'
import { Game, PhaseTypes } from '../../types/types'
import { getPhaseForStep, getNavPhases, PHASE_DISPLAY_NAMES } from '../../config/phases'
import Text from '../Text'
import ButtonLiquid from '../ButtonLiquid'
import GlassBubble from '../GlassBubble'

type NavProps = {
	gameStatus?: Game['status']
	code?: string
	connected: boolean
	qualifiedPlayersCount?: number
	onEndGame: () => void | Promise<void>
}

export default function Nav({ gameStatus, code, connected, qualifiedPlayersCount, onEndGame }: NavProps) {
	const currentPhase = gameStatus ? getPhaseForStep(gameStatus) : null
	const phaseDisplay = getNavPhases(qualifiedPlayersCount ?? 0, currentPhase)
	const [displayedPhase, setDisplayedPhase] = useState<PhaseTypes | null>(currentPhase)
	const [statusPhase, setStatusPhase] = useState<'in' | 'out'>('in')
	const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		if (currentPhase === displayedPhase) return

		if (transitionTimeoutRef.current) {
			clearTimeout(transitionTimeoutRef.current)
		}

		if (!displayedPhase) {
			setDisplayedPhase(currentPhase)
			setStatusPhase('in')
			return
		}

		setStatusPhase('out')
		transitionTimeoutRef.current = setTimeout(() => {
			setDisplayedPhase(currentPhase)
			setStatusPhase('out')
			requestAnimationFrame(() => setStatusPhase('in'))
		}, 220)
	}, [currentPhase, displayedPhase])

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
                    <Text color="text-secondary" size={1.2} bold allCaps>Code</Text>
                    <Text color="text-primary" size={2.3} bold>{code || '----'}</Text>
				</div>

                <div style={{ flexDirection: 'row', display: 'flex', alignItems: 'center', gap: 16 }}>
					{phaseDisplay.map((phase) => (
						displayedPhase === phase ? (
							<GlassBubble
								key={phase}
								style={{
									padding: '8px 16px',
									opacity: statusPhase === 'out' ? 0 : 1,
									transition: 'opacity 220ms ease'
								}}
							>
								<Text color="text-primary" size={1.2} bold allCaps>
									{PHASE_DISPLAY_NAMES[phase]}
								</Text>
							</GlassBubble>
						) : (
							<div style={{ padding: '8px 16px', borderRadius: '40px', backgroundColor: 'transparent', boxShadow: 'none' }} key={phase}>
								<Text color="text-secondary" size={1.2} bold allCaps>
									{PHASE_DISPLAY_NAMES[phase]}
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
