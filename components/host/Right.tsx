import { useEffect, useMemo, useRef, useState } from 'react'
import { Game } from '../../types/types'
import Text from '../Text'
import CandidateListItem from './CandidateListItem'

type RightProps = {
	qualifiedPlayers?: Game['players']
	sortedBarredPlayers?: Game['players']
	gameStatus?: Game['status']
	isLeaderRevealed?: boolean
}

export default function Right({
	qualifiedPlayers = [],
	sortedBarredPlayers = [],
	gameStatus,
	isLeaderRevealed = false
}: RightProps = {}) {
	const orderIdsEqual = (a: string[], b: string[]) => {
		if (a.length !== b.length) return false
		for (let i = 0; i < a.length; i += 1) {
			if (a[i] !== b[i]) return false
		}
		return true
	}

	const voteMapsEqual = (a: Record<string, number>, b: Record<string, number>) => {
		const aKeys = Object.keys(a)
		const bKeys = Object.keys(b)
		if (aKeys.length !== bKeys.length) return false
		for (const key of aKeys) {
			if (a[key] !== b[key]) return false
		}
		return true
	}

	const [displayVoteMap, setDisplayVoteMap] = useState<Record<string, number>>({})
	const [revealedVoteMap, setRevealedVoteMap] = useState<Record<string, number>>({})
	const [qualifiedOrderIds, setQualifiedOrderIds] = useState<string[]>([])
	const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})

	const qualifiedById = useMemo(
		() => Object.fromEntries(qualifiedPlayers.map(player => [player.id, player])),
		[qualifiedPlayers]
	)

	const targetOrderIds = useMemo(() => {
		if ((gameStatus === 'results' || gameStatus === 'final') && isLeaderRevealed) {
			return [...qualifiedPlayers]
				.sort((a, b) => {
					if (a.leader && !b.leader) return -1
					if (!a.leader && b.leader) return 1
					return b.votes - a.votes
				})
				.map(player => player.id)
		}

		// Preserve current order during results/final announcement or vote scramble
		if ((gameStatus === 'results' || gameStatus === 'final') || Object.keys(revealedVoteMap).length > 0) {
			const qualifiedIds = qualifiedPlayers.map(player => player.id)
			const qualifiedSet = new Set(qualifiedIds)
			if (qualifiedOrderIds.length === 0) {
				return qualifiedIds
			}
			const validCurrent = qualifiedOrderIds.filter(id => qualifiedSet.has(id))
			const added = qualifiedIds.filter(id => !qualifiedOrderIds.includes(id))
			return [...validCurrent, ...added]
		}

		return qualifiedPlayers.map(player => player.id)
	}, [qualifiedPlayers, gameStatus, isLeaderRevealed, revealedVoteMap, qualifiedOrderIds])

	useEffect(() => {
		if (gameStatus === 'final') {
			const finalVotes = Object.fromEntries(qualifiedPlayers.map(player => [player.id, player.votes]))
			setDisplayVoteMap(prev => voteMapsEqual(prev, finalVotes) ? prev : finalVotes)
			setRevealedVoteMap(prev => {
				const merged = { ...prev, ...finalVotes }
				return voteMapsEqual(prev, merged) ? prev : merged
			})
			return
		}

		if (gameStatus !== 'results') {
			setDisplayVoteMap(() => {
				const next: Record<string, number> = {}
				qualifiedPlayers.forEach(player => {
					const rememberedVotes = revealedVoteMap[player.id]
					if (rememberedVotes !== undefined) {
						next[player.id] = rememberedVotes
					}
				})
				return next
			})
			return
		}

		if (isLeaderRevealed) {
			const revealedVotes = Object.fromEntries(qualifiedPlayers.map(player => [player.id, player.votes]))
			const hasNewData = qualifiedPlayers.some(p => revealedVoteMap[p.id] !== p.votes)
			if (hasNewData) {
				setRevealedVoteMap(prev => {
					const merged = { ...prev, ...revealedVotes }
					return voteMapsEqual(prev, merged) ? prev : merged
				})
			}
			setDisplayVoteMap(prev => voteMapsEqual(prev, revealedVotes) ? prev : revealedVotes)
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
	}, [qualifiedPlayers, gameStatus, isLeaderRevealed, revealedVoteMap])

	useEffect(() => {
		if (qualifiedOrderIds.length === 0) {
			setQualifiedOrderIds(prev => orderIdsEqual(prev, targetOrderIds) ? prev : targetOrderIds)
			return
		}

		const orderChanged = qualifiedOrderIds.length !== targetOrderIds.length
			|| qualifiedOrderIds.some((id, idx) => id !== targetOrderIds[idx])

		if (!orderChanged) return

		// During the results scramble phase keep names in their current positions.
		// Only add/remove players who joined or left the qualified list.
		if ((gameStatus === 'results' || gameStatus === 'final') && !isLeaderRevealed) {
			const targetSet = new Set(targetOrderIds)
			const validCurrent = qualifiedOrderIds.filter(id => targetSet.has(id))
			const added = targetOrderIds.filter(id => !qualifiedOrderIds.includes(id))
			const nextOrder = [...validCurrent, ...added]
			setQualifiedOrderIds(prev => orderIdsEqual(prev, nextOrder) ? prev : nextOrder)
			return
		}

		const firstPositions: Record<string, number> = {}
		qualifiedOrderIds.forEach(id => {
			const element = itemRefs.current[id]
			if (element) {
				firstPositions[id] = element.getBoundingClientRect().top
			}
		})

		setQualifiedOrderIds(prev => orderIdsEqual(prev, targetOrderIds) ? prev : targetOrderIds)

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
	}, [targetOrderIds, qualifiedOrderIds, gameStatus, isLeaderRevealed])

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
            <Text color='text-primary' size={1} allCaps bold>
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
								showVotes={gameStatus === 'vote' || gameStatus === 'results' || gameStatus === 'final' || displayVoteMap[player.id] !== undefined}
								displayVotes={displayVoteMap[player.id] ?? player.votes}
								isLeaderRevealed={isLeaderRevealed}
							/>
						</div>
					))
				)}
            </div>
            <Text color='text-secondary' size={1} allCaps bold>
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
