import { useEffect, useRef } from 'react'
import { useToolStore } from '../stores/toolStore'

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

export function useToolStatus() {
  const tools = useToolStore(s => s.tools)
  const setTools = useToolStore(s => s.setTools)
  const updateTool = useToolStore(s => s.updateTool)
  // 追踪所有 timeout 以便清理
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Load tools on mount
  useEffect(() => {
    if (isElectron) {
      window.devhub?.tools?.getStatus?.()
        ?.then(setTools)
        ?.catch((error: Error) => {
          console.warn('Failed to load tool status:', error.message)
        })
    }
  }, [setTools])

  // Subscribe to completion events
  useEffect(() => {
    if (!isElectron) return

    const unsubscribe = window.devhub?.tools?.onComplete?.((tool) => {
      updateTool(tool.id, { status: 'completed', lastCompletedAt: Date.now() })

      // 清除之前的 timeout
      const existingTimeout = timeoutsRef.current.get(tool.id)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      // Reset to idle after 5 seconds
      const timeout = setTimeout(() => {
        updateTool(tool.id, { status: 'idle' })
        timeoutsRef.current.delete(tool.id)
      }, 5000)

      timeoutsRef.current.set(tool.id, timeout)
    })

    const timeouts = timeoutsRef.current
    return () => {
      unsubscribe?.()
      // 清理所有 timeout
      timeouts.forEach((timeout) => clearTimeout(timeout))
      timeouts.clear()
    }
  }, [updateTool])

  // Periodic refresh
  useEffect(() => {
    if (!isElectron) return

    let isMounted = true

    const interval = setInterval(async () => {
      try {
        const status = await window.devhub?.tools?.getStatus?.()
        if (isMounted && status) {
          setTools(status)
        }
      } catch (error) {
        console.warn('Failed to refresh tool status:', error instanceof Error ? error.message : 'Unknown error')
      }
    }, 5000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [setTools])

  return { tools }
}
