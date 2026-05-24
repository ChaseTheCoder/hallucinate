import {
  gameContent,
  barAnotherAnnouncementExtension,
  selfImmunityAnnouncementExtension,
  grantImmunityAnnouncementExtension,
} from './content'
import { ExecutiveDecisionType, StatusTypes } from '../types/types'

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

const EXECUTIVE_DECISION_AUDIO_FOLDERS: Partial<Record<ExecutiveDecisionType, string>> = {
  bar_another: 'barAnotherAnnouncementExtension',
  self_immunity_next_cycle: 'selfImmunityAnnouncementExtension',
  grant_immunity_next_cycle: 'grantImmunityAnnouncementExtension',
}

function getExecutiveDecisionAnnouncementExtension(executiveDecision?: ExecutiveDecisionType): string[] {
  if (executiveDecision === 'bar_another') return barAnotherAnnouncementExtension
  if (executiveDecision === 'self_immunity_next_cycle') return selfImmunityAnnouncementExtension
  if (executiveDecision === 'grant_immunity_next_cycle') return grantImmunityAnnouncementExtension
  return []
}

function getEffectiveHostMessages(status: StatusTypes, executiveDecision?: ExecutiveDecisionType): string[] {
  const baseMessages = asHostMessages(gameContent[status]?.hostMessage)
  if (status !== 'announcement') return baseMessages

  const extensionMessages = getExecutiveDecisionAnnouncementExtension(executiveDecision)
  if (!extensionMessages.length) return baseMessages
  return [...baseMessages, ...extensionMessages]
}

function logExecutiveDecisionAudio(event: string, data: Record<string, unknown>) {
  console.log('[HostNarration][ExecutiveAudio]', event, data)
}

function buildAudioObjectKey(status: StatusTypes, index: number, executiveDecision?: ExecutiveDecisionType): string {
  const prefix = AUDIO_OBJECT_VERSION_PREFIX.replace(/^\/+|\/+$/g, '')
  const suffix = AUDIO_OBJECT_SUFFIX

  const buildKey = (path: string, keyIndex: number): string => {
    if (!suffix) {
      return `${path}/${keyIndex}`
    }
    return `${path}/${keyIndex}${suffix}`
  }

  if (status === 'decision' && executiveDecision) {
    const folder = EXECUTIVE_DECISION_AUDIO_FOLDERS[executiveDecision]
    if (folder) {
      if (index === 0) {
        const key = buildKey(`${prefix}/announcement/executive-decisions`, 0)
        logExecutiveDecisionAudio('decision.shared-intro', {
          status,
          executiveDecision,
          index,
          folder,
          key,
        })
        return key
      }
      const key = buildKey(`${prefix}/announcement/executive-decisions/${folder}`, index)
      logExecutiveDecisionAudio('decision.extension-line', {
        status,
        executiveDecision,
        index,
        folder,
        key,
      })
      return key
    }
  }

  if (status === 'announcement' && executiveDecision) {
    const announcementMessageCount = asHostMessages(gameContent.announcement.hostMessage).length
    const folder = EXECUTIVE_DECISION_AUDIO_FOLDERS[executiveDecision]
    if (folder && index >= announcementMessageCount) {
      const executiveDecisionIndex = index - announcementMessageCount
      if (executiveDecisionIndex === 0) {
        const key = buildKey(`${prefix}/announcement/executive-decisions`, 0)
        logExecutiveDecisionAudio('announcement.shared-intro', {
          status,
          executiveDecision,
          index,
          executiveDecisionIndex,
          announcementMessageCount,
          folder,
          key,
        })
        return key
      }
      const key = buildKey(`${prefix}/announcement/executive-decisions/${folder}`, executiveDecisionIndex)
      logExecutiveDecisionAudio('announcement.extension-line', {
        status,
        executiveDecision,
        index,
        executiveDecisionIndex,
        announcementMessageCount,
        folder,
        key,
      })
      return key
    }
  }

  if (executiveDecision && status === 'decision') {
    logExecutiveDecisionAudio('fallback.default-status-key', {
      status,
      executiveDecision,
      index,
      reason: 'No executive decision extension mapping applied',
    })
  }

  if (executiveDecision && status === 'announcement') {
    const announcementMessageCount = asHostMessages(gameContent.announcement.hostMessage).length
    if (index >= announcementMessageCount) {
      logExecutiveDecisionAudio('fallback.default-status-key', {
        status,
        executiveDecision,
        index,
        reason: 'Expected executive decision extension mapping, but no folder mapping applied',
      })
    }
  }

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

function computePauseMs(status: StatusTypes, index: number, total: number, id: string): number {
  if (DRAMATIC_PAUSE_OVERRIDES_MS[id] !== undefined) {
    return DRAMATIC_PAUSE_OVERRIDES_MS[id]
  }

  const isLast = index === total - 1
  const isSecondToLast = index === total - 2

  // Final winner reveal — stay on screen indefinitely until host ends game
  if (status === 'final' && isLast) {
    return Infinity
  }

  // Dramatic pause before leader/winner name is revealed
  if ((status === 'results' || status === 'announcement' || status === 'final') && (isSecondToLast || isLast)) {
    return 8000
  }

  return DEFAULT_HOST_PAUSE_MS
}

export function getHostNarrationSegments(status: StatusTypes, executiveDecision?: ExecutiveDecisionType): HostNarrationSegment[] {
  const hostMessages = getEffectiveHostMessages(status, executiveDecision)

  return hostMessages.map((text, index) => {
    const id = `${status}.hostMessage.${index}`
    const audioObjectKey = buildAudioObjectKey(status, index, executiveDecision)
    return {
      id,
      status,
      index,
      text,
      audioObjectKey,
      audioUrl: buildAudioUrl(audioObjectKey),
      pauseAfterMs: computePauseMs(status, index, hostMessages.length, id),
      hasDynamicTokens: text.includes('{') && text.includes('}')
    }
  })
}

export function getHostNarrationSegment(status: StatusTypes, index: number, executiveDecision?: ExecutiveDecisionType): HostNarrationSegment | null {
  const segments = getHostNarrationSegments(status, executiveDecision)
  const segment = segments[index] ?? null

  if (executiveDecision && (status === 'decision' || status === 'announcement')) {
    logExecutiveDecisionAudio('segment.lookup', {
      status,
      executiveDecision,
      index,
      found: Boolean(segment),
      audioObjectKey: segment?.audioObjectKey ?? null,
      audioUrl: segment?.audioUrl ?? null,
      hasDynamicTokens: segment?.hasDynamicTokens ?? null,
      totalSegments: segments.length,
    })
  }

  return segment
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
