const submitDecision = async (gameCode: string, submittingLeaderId: string, submittingBarredId: string) => {
    const res = await fetch(`/api/game/${gameCode}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaderId: submittingLeaderId,
          barredId: submittingBarredId
        })
    })

    if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || 'Failed to submit decision')
    }
}