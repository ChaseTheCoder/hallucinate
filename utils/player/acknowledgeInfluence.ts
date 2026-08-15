const acknowledgeInfluence = async (gameCode: string, playerId: string) => {
  const res = await fetch(`/api/game/${gameCode}/acknowledge-influence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId })
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || 'Failed to acknowledge influence')
  }

  return res.json()
}

export default acknowledgeInfluence
