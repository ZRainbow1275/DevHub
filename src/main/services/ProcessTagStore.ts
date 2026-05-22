import { createHash } from 'crypto'
import Store from 'electron-store'
import {
  processTagSchema,
  processTagsImportRequestSchema,
  processTagSetRequestSchema,
  type ProcessTag,
  type ProcessTagColor,
  type ProcessTagSetRequest,
  type ProcessTagsImportResponse,
} from '@shared/schemas/r8-runtime'
import { buildProcessIdentityPair, normalizeProcessTagText } from '@shared/process-tags-history'

interface ProcessTagStoreShape {
  tags: Record<string, ProcessTag>
}

const DEFAULT_STORE: ProcessTagStoreShape = { tags: {} }

export function makeProcessTagKey(exe: string, cwd?: string): string {
  return createHash('sha256').update(buildProcessIdentityPair(exe, cwd)).digest('hex')
}

export class ProcessTagStore {
  private readonly store: Store<ProcessTagStoreShape>

  constructor(store?: Store<ProcessTagStoreShape>) {
    this.store = store ?? new Store<ProcessTagStoreShape>({
      name: 'devhub-process-tags',
      defaults: DEFAULT_STORE,
    })
  }

  list(): ProcessTag[] {
    const raw = this.store.get('tags', {})
    return Object.values(raw)
      .map(value => processTagSchema.safeParse(value))
      .filter((result): result is { success: true; data: ProcessTag } => result.success)
      .map(result => result.data)
      .sort((left, right) => right.updatedAt - left.updatedAt)
  }

  get(exe: string, cwd?: string): ProcessTag | null {
    const key = makeProcessTagKey(exe, cwd)
    const parsed = processTagSchema.safeParse(this.store.get('tags', {})[key])
    return parsed.success ? parsed.data : null
  }

  set(input: ProcessTagSetRequest): ProcessTag {
    const parsed = processTagSetRequestSchema.parse(input)
    const key = makeProcessTagKey(parsed.exe, parsed.cwd)
    const now = Date.now()
    const tags = { ...this.store.get('tags', {}) }
    const existing = processTagSchema.safeParse(tags[key])
    const tag = processTagSchema.parse({
      key,
      exe: parsed.exe,
      cwd: parsed.cwd,
      tag: normalizeProcessTagText(parsed.tag),
      color: parsed.color,
      pinned: parsed.pinned ?? (existing.success ? existing.data.pinned : false),
      createdAt: existing.success ? existing.data.createdAt : now,
      updatedAt: now,
    })
    tags[key] = tag
    this.store.set('tags', tags)
    return tag
  }

  remove(exe: string, cwd?: string): { success: boolean; removed: number; key: string } {
    const key = makeProcessTagKey(exe, cwd)
    const tags = { ...this.store.get('tags', {}) }
    if (!tags[key]) {
      return { success: false, removed: 0, key }
    }
    delete tags[key]
    this.store.set('tags', tags)
    return { success: true, removed: 1, key }
  }

  exportJson(): string {
    return JSON.stringify({ version: 1, exportedAt: Date.now(), tags: this.list() }, null, 2)
  }

  importJson(json: string): ProcessTagsImportResponse {
    const { json: payload } = processTagsImportRequestSchema.parse({ json })
    const parsed = JSON.parse(payload) as unknown
    const input = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { tags?: unknown }).tags)
        ? (parsed as { tags: unknown[] }).tags
        : []

    const tags = { ...this.store.get('tags', {}) }
    let imported = 0
    let skipped = 0
    for (const candidate of input) {
      const tag = processTagSchema.safeParse(candidate)
      if (!tag.success) {
        skipped += 1
        continue
      }
      const key = makeProcessTagKey(tag.data.exe, tag.data.cwd)
      tags[key] = processTagSchema.parse({ ...tag.data, key, updatedAt: Date.now() })
      imported += 1
    }
    this.store.set('tags', tags)
    return { success: true, imported, skipped }
  }

  setPinned(exe: string, cwd: string | undefined, pinned: boolean): ProcessTag | null {
    const existing = this.get(exe, cwd)
    if (!existing) return null
    return this.set({
      exe,
      cwd,
      tag: existing.tag,
      color: existing.color as ProcessTagColor | undefined,
      pinned,
    })
  }
}
