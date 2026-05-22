import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ProcessInfo } from '@shared/types-extended'
import { processTagsListResponseSchema, type ProcessTag, type ProcessTagColor } from '@shared/schemas/r8-runtime'
import { buildProcessIdentityPair } from '@shared/process-tags-history'

export function processIdentityForProcess(process: Pick<ProcessInfo, 'name' | 'workingDir'>): string {
  return buildProcessIdentityPair(process.name, process.workingDir)
}

export function useProcessTagRegistry() {
  const [tags, setTags] = useState<ProcessTag[]>([])
  const [loading, setLoading] = useState(false)

  const reloadTags = useCallback(async () => {
    setLoading(true)
    try {
      const response = await window.devhub.systemProcess.listProcessTags()
      const parsed = processTagsListResponseSchema.safeParse(response)
      setTags(parsed.success ? parsed.data.tags : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reloadTags().catch(() => setTags([]))
  }, [reloadTags])

  const tagByIdentity = useMemo(() => {
    const map = new Map<string, ProcessTag>()
    for (const tag of tags) {
      map.set(buildProcessIdentityPair(tag.exe, tag.cwd), tag)
    }
    return map
  }, [tags])

  const getTag = useCallback((process: Pick<ProcessInfo, 'name' | 'workingDir'>): ProcessTag | undefined => {
    return tagByIdentity.get(processIdentityForProcess(process))
  }, [tagByIdentity])

  const setTag = useCallback(async (
    process: Pick<ProcessInfo, 'name' | 'workingDir'>,
    tag: string,
    color?: ProcessTagColor,
    pinned?: boolean,
  ) => {
    const saved = await window.devhub.systemProcess.setProcessTag({
      exe: process.name,
      cwd: process.workingDir,
      tag,
      color,
      pinned,
    })
    setTags(current => [saved, ...current.filter(item => item.key !== saved.key)])
    return saved
  }, [])

  const removeTag = useCallback(async (process: Pick<ProcessInfo, 'name' | 'workingDir'>) => {
    const result = await window.devhub.systemProcess.removeProcessTag({
      exe: process.name,
      cwd: process.workingDir,
    })
    if (result.removed > 0) {
      setTags(current => current.filter(item => item.key !== result.key))
    }
    return result
  }, [])

  return { tags, loading, getTag, setTag, removeTag, reloadTags }
}
