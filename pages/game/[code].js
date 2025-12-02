import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function GamePage() {
  const router = useRouter()
  const { code } = router.query

  useEffect(() => {
    // Redirect to host page
    if (code) {
      router.replace(`/host/${code}`)
    }
  }, [code, router])

  return <div style={{ padding: 24 }}>Redirecting...</div>
}
