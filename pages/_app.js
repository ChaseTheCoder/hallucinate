import { useEffect } from 'react'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Initialize Socket.IO server by calling the socket.js endpoint
    fetch('/api/socket')
  }, [])

  return <Component {...pageProps} />
}
