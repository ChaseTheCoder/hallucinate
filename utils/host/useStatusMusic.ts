import { useEffect, useRef } from 'react'
import type { Game } from '../../types/types'
import { getStatusMusicUrl } from './utils'

const QUIET_VOLUME = 0.08
const DEFAULT_VOLUME = 0.2
const FADE_UP_MS = 2000

/**
 * Determine which status's music should be playing.
 * Special case: results music persists and loops through decision status.
 */
function getActiveStatusForMusic(status?: Game['status'] | null): Game['status'] | null {
  if (!status) return null
  
  // Results music plays during results AND decision statuses
  if (status === 'results' || status === 'decision') {
    return 'results'
  }
  
  return status
}

export default function useStatusMusic(gameStatus?: Game['status'] | null, isNarrationPlaying: boolean = false) {
  const musicAudioRef = useRef<HTMLAudioElement | null>(null)
  const fadeRafRef = useRef<number | null>(null)
  const activeMusicStatusRef = useRef<Game['status'] | null>(null)

  const stopFade = () => {
    if (fadeRafRef.current != null) {
      cancelAnimationFrame(fadeRafRef.current)
      fadeRafRef.current = null
    }
  }

  const fadeToVolume = (audio: HTMLAudioElement, target: number, durationMs: number) => {
    stopFade()

    const startVolume = audio.volume
    if (Math.abs(startVolume - target) < 0.001) {
      audio.volume = target
      return
    }

    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / durationMs)
      audio.volume = startVolume + (target - startVolume) * progress

      if (progress < 1) {
        fadeRafRef.current = requestAnimationFrame(tick)
      } else {
        fadeRafRef.current = null
      }
    }

    fadeRafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    const activeMusicStatus = getActiveStatusForMusic(gameStatus)
    const prevMusicStatus = activeMusicStatusRef.current

    // If music status hasn't changed, keep existing audio
    if (activeMusicStatus === prevMusicStatus && musicAudioRef.current) {
      return
    }

    // Music status changed, stop old audio and start new
    activeMusicStatusRef.current = activeMusicStatus

    stopFade()
    if (musicAudioRef.current) {
      musicAudioRef.current.pause()
      musicAudioRef.current = null
    }

    const musicUrl = getStatusMusicUrl(activeMusicStatus)
    if (!musicUrl) {
      return
    }

    const music = new Audio(musicUrl)
    music.loop = true
    music.preload = 'auto'
    music.crossOrigin = 'anonymous'
    music.volume = DEFAULT_VOLUME
    musicAudioRef.current = music

    music.play().catch((error: unknown) => {
      const err = error as { name?: string }
      if (err?.name === 'NotAllowedError') {
        console.log('Browser blocked music autoplay; it will retry on next interaction.')
      }
    })

    return () => {
      stopFade()
      music.pause()
      if (musicAudioRef.current === music) {
        musicAudioRef.current = null
      }
    }
  }, [gameStatus])

  useEffect(() => {
    const music = musicAudioRef.current
    const activeMusicStatus = getActiveStatusForMusic(gameStatus)
    if (!music || !getStatusMusicUrl(activeMusicStatus)) return

    if (isNarrationPlaying) {
      stopFade()
      music.volume = QUIET_VOLUME
      return
    }

    fadeToVolume(music, DEFAULT_VOLUME, FADE_UP_MS)
  }, [gameStatus, isNarrationPlaying])

  useEffect(() => {
    return () => {
      stopFade()
    }
  }, [])
}