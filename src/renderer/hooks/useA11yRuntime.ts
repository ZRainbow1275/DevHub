import { useCallback, useEffect, useMemo, useState } from 'react'
import { a11yPrefsSchema, type A11yOsPrefs, type A11yPrefs } from '@shared/schemas/r8-runtime'
import { applyA11yDocumentState, DEFAULT_A11Y_OS_PREFS, DEFAULT_A11Y_PREFS } from '../utils/a11y-checks'
import { usePrefersContrast } from './usePrefersContrast'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

const A11Y_PREFS_CHANGED_EVENT = 'devhub:a11y-prefs-changed'

export interface A11yRuntimeState {
  prefs: A11yPrefs
  osPrefs: A11yOsPrefs
  savePrefs: (prefs: A11yPrefs) => Promise<A11yPrefs>
}

export function useA11yRuntime(): A11yRuntimeState {
  const reducedMotion = usePrefersReducedMotion()
  const contrast = usePrefersContrast()
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULT_A11Y_PREFS)
  const [mainOsPrefs, setMainOsPrefs] = useState<A11yOsPrefs>(DEFAULT_A11Y_OS_PREFS)

  const osPrefs = useMemo<A11yOsPrefs>(() => ({
    reducedMotion: mainOsPrefs.reducedMotion || reducedMotion,
    highContrast: mainOsPrefs.highContrast || contrast,
    forcedColors: mainOsPrefs.forcedColors || contrast,
  }), [contrast, mainOsPrefs, reducedMotion])

  useEffect(() => {
    let disposed = false
    const load = async () => {
      const api = window.devhub?.r8?.a11y
      if (!api) {
        return
      }
      const storedPrefs = await api.getPrefs()
      if (disposed) {
        return
      }
      setPrefs(a11yPrefsSchema.parse(storedPrefs))
      const storedOsPrefs = await api.osPrefs().catch(() => DEFAULT_A11Y_OS_PREFS)
      if (disposed) {
        return
      }
      setMainOsPrefs(storedOsPrefs)
    }

    load().catch(() => undefined)
    const handlePrefsChanged = () => {
      load().catch(() => undefined)
    }
    window.addEventListener(A11Y_PREFS_CHANGED_EVENT, handlePrefsChanged)
    return () => {
      disposed = true
      window.removeEventListener(A11Y_PREFS_CHANGED_EVENT, handlePrefsChanged)
    }
  }, [])

  useEffect(() => {
    applyA11yDocumentState(document.documentElement, prefs, osPrefs)
  }, [osPrefs, prefs])

  const savePrefs = useCallback(async (nextPrefs: A11yPrefs): Promise<A11yPrefs> => {
    const parsed = a11yPrefsSchema.parse(nextPrefs)
    const api = window.devhub?.r8?.a11y
    if (!api) {
      setPrefs(parsed)
      return parsed
    }
    const saved = await api.setPrefs(parsed)
    setPrefs(saved)
    window.dispatchEvent(new Event(A11Y_PREFS_CHANGED_EVENT))
    return saved
  }, [])

  return { prefs, osPrefs, savePrefs }
}
