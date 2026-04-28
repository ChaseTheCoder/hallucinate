import { useEffect, useMemo, useRef, useState } from 'react'
import { Game } from '../../types/types'
import Text from '../Text'
import CandidateListItem from './CandidateListItem'

type RightProps = {
	qualifiedPlayers?: Game['players']
	sortedBarredPlayers?: Game['players']
	gameStatus?: Game['status']
	isResultsLeaderRevealed?: boolean
}

export default function Right({
	qualifiedPlayers = [],
	sortedBarredPlayers = [],
	gameStatus,
	isResultsLeaderRevealed = false
}: RightProps = {}) {
	const [displayVoteMap, setDisplayVoteMap] = useState<Record<string, number>>({})
	const [qualifiedOrderIds, setQualifiedOrderIds] = useState<string[]>([])
	const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})

	const qualifiedById = useMemo(
		() => Object.fromEntries(qualifiedPlayers.map(player => [player.id, player])),
		[qualifiedPlayers]
	)

	const targetOrderIds = useMemo(() => {
		if (gameStatus === 'results' && isResultsLeaderRevealed) {
			return [...qualifiedPlayers]
				.sort((a, b) => {
					if (a.leader && !b.leader) return -1
					if (!a.leader && b.leader) return 1
					return b.votes - a.votes
				})
				.map(player => player.id)
		}

		return qualifiedPlayers.map(player => player.id)
	}, [qualifiedPlayers, gameStatus, isResultsLeaderRevealed])

	useEffect(() => {
		if (gameStatus !== 'results') {
			setDisplayVoteMap(Object.fromEntries(qualifiedPlayers.map(player => [player.id, player.votes])))
			return
		}

		if (isResultsLeaderRevealed) {
			setDisplayVoteMap(Object.fromEntries(qualifiedPlayers.map(player => [player.id, player.votes])))
			return
		}

		const interval = setInterval(() => {
			setDisplayVoteMap(prev => {
				const next: Record<string, number> = {}
				qualifiedPlayers.forEach(player => {
					const range = Math.max(10, player.votes + 6)
					next[player.id] = Math.floor(Math.random() * range)
				})
				return { ...prev, ...next }
			})
		}, 80)

		return () => clearInterval(interval)
	}, [qualifiedPlayers, gameStatus, isResultsLeaderRevealed])

	useEffect(() => {
		if (qualifiedOrderIds.length === 0) {
			setQualifiedOrderIds(targetOrderIds)
			return
		}

		const orderChanged = qualifiedOrderIds.length !== targetOrderIds.length
			|| qualifiedOrderIds.some((id, idx) => id !== targetOrderIds[idx])

		if (!orderChanged) return

		// During the results scramble phase keep names in their current positions.
		// Only add/remove players who joined or left the qualified list.
		if (gameStatus === 'results' && !isResultsLeaderRevealed) {
			const targetSet = new Set(targetOrderIds)
			const validCurrent = qualifiedOrderIds.filter(id => targetSet.has(id))
			const added = targetOrderIds.filter(id => !qualifiedOrderIds.includes(id))
			setQualifiedOrderIds([...validCurrent, ...added])
			return
		}

		const firstPositions: Record<string, number> = {}
		qualifiedOrderIds.forEach(id => {
			const element = itemRefs.current[id]
			if (element) {
				firstPositions[id] = element.getBoundingClientRect().top
			}
		})

		setQualifiedOrderIds(targetOrderIds)

		requestAnimationFrame(() => {
			targetOrderIds.forEach(id => {
				const element = itemRefs.current[id]
				if (!element) return
				const previousTop = firstPositions[id]
				if (previousTop === undefined) return

				const newTop = element.getBoundingClientRect().top
				const deltaY = previousTop - newTop
				if (deltaY === 0) return

				element.style.transition = 'none'
				element.style.transform = `translateY(${deltaY}px)`
				void element.offsetHeight
				element.style.transition = 'transform 500ms cubic-bezier(0.22, 1, 0.36, 1)'
				element.style.transform = 'translateY(0)'
			})
		})
	}, [targetOrderIds, qualifiedOrderIds, gameStatus, isResultsLeaderRevealed])

	const orderedQualifiedPlayers = qualifiedOrderIds
		.map(id => qualifiedById[id])
		.filter((player): player is NonNullable<typeof player> => Boolean(player))

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
					orderedQualifiedPlayers.map((player) => (
						<div
							key={player.id}
							ref={(node) => {
								itemRefs.current[player.id] = node
							}}
						>
							<CandidateListItem
								player={player}
								showVotes={gameStatus === 'results'}
								displayVotes={displayVoteMap[player.id]}
							/>
						</div>
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
