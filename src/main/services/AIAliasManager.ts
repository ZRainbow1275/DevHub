import Store from 'electron-store'
import { createHash } from 'crypto'
import { AIWindowAlias, AIToolType, ProcessInfo, WindowInfo } from '@shared/types-extended'

interface AIAliasStoreSchema {
  aliases: AIWindowAlias[]
}

export class AIAliasManager {
  private store: Store<AIAliasStoreSchema>

  constructor() {
    this.store = new Store<AIAliasStoreSchema>({
      name: 'devhub-ai-aliases',
      schema: {
        aliases: {
          type: 'array' as const,
          default: []
        }
      }
    })
  }

  getAll(): AIWindowAlias[] {
    return this.store.get('aliases', [])
  }

  set(alias: AIWindowAlias): boolean {
    const aliases = this.getAll()
    const index = aliases.findIndex(a => a.id === alias.id)
    if (index >= 0) {
      aliases[index] = alias
    } else {
      aliases.push(alias)
    }
    this.store.set('aliases', aliases)
    return true
  }

  remove(aliasId: string): boolean {
    const aliases = this.getAll()
    const filtered = aliases.filter(a => a.id !== aliasId)
    if (filtered.length === aliases.length) return false
    this.store.set('aliases', filtered)
    return true
  }

  matchAlias(
    window: WindowInfo | undefined,
    process: ProcessInfo,
    toolType: AIToolType
  ): AIWindowAlias | null {
    const aliases = this.getAll()
    if (aliases.length === 0) return null

    let bestAlias: AIWindowAlias | null = null
    let bestScore = 0

    for (const alias of aliases) {
      let score = 0

      // toolType must match; mismatch means score = 0
      if (alias.matchCriteria.toolType !== toolType) continue

      // PID exact match (most reliable while process alive)
      if (alias.matchCriteria.pid != null && alias.matchCriteria.pid === process.pid) {
        score += 50
      }

      // Working directory match (stable across restart)
      if (
        alias.matchCriteria.workingDir &&
        process.workingDir &&
        alias.matchCriteria.workingDir === process.workingDir
      ) {
        score += 30
      }

      // Command hash match (stable across restart)
      if (
        alias.matchCriteria.commandHash &&
        alias.matchCriteria.commandHash === hashCommand(process.command)
      ) {
        score += 15
      }

      // Title prefix match (weakest signal)
      if (
        alias.matchCriteria.titlePrefix &&
        window?.title?.startsWith(alias.matchCriteria.titlePrefix)
      ) {
        score += 5
      }

      if (score > bestScore) {
        bestScore = score
        bestAlias = alias
      }
    }

    // Threshold: at least 30 (workingDir alone is enough)
    return bestScore >= 30 ? bestAlias : null
  }

  updateLastMatched(aliasId: string): void {
    const aliases = this.getAll()
    const alias = aliases.find(a => a.id === aliasId)
    if (alias) {
      alias.lastMatchedAt = Date.now()
      this.store.set('aliases', aliases)
    }
  }
}

export function hashCommand(command: string): string {
  return createHash('sha256').update(command).digest('hex').slice(0, 16)
}
