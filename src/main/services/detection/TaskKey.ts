import { createHash } from 'crypto'
import type { AIToolType } from '@shared/types-extended'

export function makeTaskKey(input: {
  aliasId?: string
  toolType: AIToolType
  pid: number
  workingDir?: string
}): string {
  if (input.aliasId) return `alias:${input.aliasId}`
  const stable = `${input.toolType}:${input.workingDir ?? ''}:${input.pid}`
  return `fp:${createHash('sha256').update(stable).digest('hex').slice(0, 16)}`
}

export function withCollisionSuffix(taskKey: string, existingKeys: ReadonlySet<string>): string {
  if (!existingKeys.has(taskKey)) return taskKey
  let counter = 2
  let candidate = `${taskKey}:${counter}`
  while (existingKeys.has(candidate)) {
    counter++
    candidate = `${taskKey}:${counter}`
  }
  return candidate
}
