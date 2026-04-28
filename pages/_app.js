import { useEffect } from 'react'
import Head from 'next/head'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Initialize Socket.IO server by calling the socket.js endpoint
    fetch('/api/socket')
  }, [])

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=overlays-content" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
