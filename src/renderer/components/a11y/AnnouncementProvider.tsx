import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { A11Y_LIMITS } from '@shared/schemas/r8-runtime'

export type AnnouncementPriority = 'polite' | 'assertive'

export interface AnnouncementContextValue {
  announce: (message: string, priority?: AnnouncementPriority) => void
}

export const AnnouncementContext = createContext<AnnouncementContextValue | null>(null)

interface LastAnnouncement {
  message: string
  priority: AnnouncementPriority
  ts: number
}

export function AnnouncementProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
  const lastRef = useRef<LastAnnouncement | null>(null)
  const politeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const assertiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = (priority: AnnouncementPriority) => {
    const timerRef = priority === 'polite' ? politeTimerRef : assertiveTimerRef
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const announce = useCallback((rawMessage: string, priority: AnnouncementPriority = 'polite') => {
    const message = rawMessage.trim().slice(0, 500)
    if (!message) {
      return
    }

    const now = Date.now()
    const last = lastRef.current
    if (
      last
      && last.message === message
      && last.priority === priority
      && now - last.ts < A11Y_LIMITS.ANNOUNCEMENT_DEDUPE_MS
    ) {
      return
    }

    lastRef.current = { message, priority, ts: now }
    clearTimer(priority)
    if (priority === 'assertive') {
      setAssertive(message)
      assertiveTimerRef.current = setTimeout(() => setAssertive(''), 2000)
    } else {
      setPolite(message)
      politeTimerRef.current = setTimeout(() => setPolite(''), 2000)
    }
  }, [])

  useEffect(() => () => {
    clearTimer('polite')
    clearTimer('assertive')
  }, [])

  const value = useMemo<AnnouncementContextValue>(() => ({ announce }), [announce])

  return (
    <AnnouncementContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="a11y-live-polite">
        {polite}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only" data-testid="a11y-live-assertive">
        {assertive}
      </div>
    </AnnouncementContext.Provider>
  )
}
