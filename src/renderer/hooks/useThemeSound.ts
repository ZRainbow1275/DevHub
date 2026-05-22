import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ThemeOption, ThemeSoundConfig } from '@shared/types'
import { THEME_SOUND_EVENTS, ThemeSoundManager, defaultThemeSoundConfig, type ThemeSoundEvent } from '../services/ThemeSounds'

function isThemeSoundEvent(value: string): value is ThemeSoundEvent {
  return (THEME_SOUND_EVENTS as readonly string[]).includes(value)
}

function closestSoundTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null
  return target.closest('[data-theme-sound], button, [role="button"], a, input, select, textarea, [data-testid*="card"], [data-testid*="tile"]')
}

export function useThemeSound(themeId: ThemeOption) {
  const manager = useMemo(() => new ThemeSoundManager(), [])
  const [config, setConfig] = useState<ThemeSoundConfig>(() => defaultThemeSoundConfig(themeId))

  useEffect(() => {
    let cancelled = false

    const soundConfigPromise = window.devhub?.r8?.themeDecoration?.getSoundConfig?.(themeId)
    if (!soundConfigPromise) {
      const fallback = defaultThemeSoundConfig(themeId)
      setConfig(fallback)
      manager.load(fallback)
      return () => {
        cancelled = true
        manager.dispose()
      }
    }

    void soundConfigPromise.then(next => {
        if (cancelled) return
        setConfig(next)
        manager.load(next)
      })
      .catch(() => {
        if (cancelled) return
        const fallback = defaultThemeSoundConfig(themeId)
        setConfig(fallback)
        manager.load(fallback)
      })

    return () => {
      cancelled = true
      manager.dispose()
    }
  }, [manager, themeId])

  const play = useCallback((event: ThemeSoundEvent) => manager.play(themeId, event), [manager, themeId])

  useEffect(() => {
    if (!config.enabled) return undefined

    const handlePointerEnter = (event: PointerEvent) => {
      const target = closestSoundTarget(event.target)
      if (!target) return
      const explicit = target.dataset.themeSound
      const soundEvent = explicit && isThemeSoundEvent(explicit) ? explicit : 'hover'
      play(soundEvent)
    }
    const handleClick = (event: MouseEvent) => {
      if (!closestSoundTarget(event.target)) return
      play('click')
    }

    document.addEventListener('pointerenter', handlePointerEnter, true)
    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('pointerenter', handlePointerEnter, true)
      document.removeEventListener('click', handleClick, true)
    }
  }, [config.enabled, play])

  return {
    config,
    play
  } as const
}
