import { gameContent } from './content'
import { StatusTypes } from '../types/types'

export const DEFAULT_HOST_PAUSE_MS = 100

export interface HostNarrationSegment {
  id: string
  status: StatusTypes
  index: number
  text: string
  audioObjectKey: string
  audioUrl: string | null
  pauseAfterMs: number
  hasDynamicTokens: boolean
}

const DRAMATIC_PAUSE_OVERRIDES_MS: Record<string, number> = {
  // 'rules.hostMessage.0': 7000,
  // 'rules.hostMessage.5': 5000,
  // 'rules.hostMessage.9': 5000,
  // 'results.hostMessage.1': 5000,
  // 'announcement.hostMessage.1': 5000,
  // 'final.hostMessage.2': 6000,
}

const AUDIO_OBJECT_VERSION_PREFIX = process.env.NEXT_PUBLIC_AUDIO_OBJECT_VERSION_PREFIX?.trim() || 'v1'
const AUDIO_OBJECT_SUFFIX = process.env.NEXT_PUBLIC_AUDIO_OBJECT_SUFFIX?.trim() || ''

function buildAudioObjectKey(status: StatusTypes, index: number): string {
  const prefix = AUDIO_OBJECT_VERSION_PREFIX.replace(/^\/+|\/+$/g, '')
  const suffix = AUDIO_OBJECT_SUFFIX
  if (!suffix) {
    return `${prefix}/${status}/${index}`
  }
  return `${prefix}/${status}/${index}${suffix}`
}

function buildAudioUrl(audioObjectKey: string): string | null {
  const base = process.env.NEXT_PUBLIC_AUDIO_OBJECT_BASE_URL?.trim()
  if (!base) return null
  const normalized = base.endsWith('/') ? base.slice(0, -1) : base
  return `${normalized}/${audioObjectKey}`
}

function asHostMessages(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((part): part is string => typeof part === 'string')
}

export function getHostNarrationSegments(status: StatusTypes): HostNarrationSegment[] {
  const hostMessages = asHostMessages(gameContent[status]?.hostMessage)

  return hostMessages.map((text, index) => {
    const id = `${status}.hostMessage.${index}`
    const audioObjectKey = buildAudioObjectKey(status, index)
    return {
      id,
      status,
      index,
      text,
      audioObjectKey,
      audioUrl: buildAudioUrl(audioObjectKey),
      pauseAfterMs: DRAMATIC_PAUSE_OVERRIDES_MS[id] ?? DEFAULT_HOST_PAUSE_MS,
      hasDynamicTokens: text.includes('{') && text.includes('}')
    }
  })
}

export function getHostNarrationSegment(status: StatusTypes, index: number): HostNarrationSegment | null {
  const segments = getHostNarrationSegments(status)
  return segments[index] ?? null
}

export function getHostNarrationManifest(): Record<StatusTypes, HostNarrationSegment[]> {
  return {
    join: getHostNarrationSegments('join'),
    rules: getHostNarrationSegments('rules'),
    campaign: getHostNarrationSegments('campaign'),
    vote: getHostNarrationSegments('vote'),
    results: getHostNarrationSegments('results'),
    decision: getHostNarrationSegments('decision'),
    announcement: getHostNarrationSegments('announcement'),
    final: getHostNarrationSegments('final'),
  }
}
