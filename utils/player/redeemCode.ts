const redeemCode = async (gameCode: string, playerId: string, code: string) => {
  const res = await fetch(`/api/game/${gameCode}/redeem-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, code })
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || 'Failed to redeem code')
  }

  return res.json()
}

export default redeemCode
