export const leaveGame = async (gameCode: string, playerName: string): Promise<void> => {
  const res = await fetch(`/api/game/${gameCode}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: playerName })
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || 'Failed to leave game')
  }
}

export default leaveGame;