import { createHash, randomUUID } from 'node:crypto'
import Store from 'electron-store'
import {
  customSvgEntrySchema,
  customSvgListResponseSchema,
  customSvgRemoveResponseSchema,
  customSvgUploadResponseSchema,
  type CustomSvgEntry,
  type CustomSvgListResponse,
  type CustomSvgRemoveRequest,
  type CustomSvgRemoveResponse,
  type CustomSvgUploadRequest,
  type CustomSvgUploadResponse
} from '@shared/schemas/r8-runtime'
import { DECORATION_LIMITS, validateSanitizedSvgContent } from '@shared/theme-decorations'

interface CustomSvgStoreShape {
  customSvgs?: unknown[]
}

export class CustomSvgStore {
  private readonly store: Store<CustomSvgStoreShape>

  constructor(store?: Store<CustomSvgStoreShape>) {
    this.store = store ?? new Store<CustomSvgStoreShape>({ name: 'devhub-r8-theme-decorations' })
  }

  list(): CustomSvgListResponse {
    const items = this.readItems()
    return customSvgListResponseSchema.parse({ items })
  }

  upload(input: CustomSvgUploadRequest): CustomSvgUploadResponse {
    const current = this.readItems()
    if (current.length >= DECORATION_LIMITS.MAX_CUSTOM_SVGS) {
      throw Object.assign(new Error('E_RATE_LIMITED:自定义 SVG 数量已达 50 个，请先清理'), { code: 'E_RATE_LIMITED' })
    }

    const validation = validateSanitizedSvgContent(input.content)
    const entry = customSvgEntrySchema.parse({
      id: randomUUID(),
      name: input.name.trim(),
      sanitizedContent: validation.sanitizedContent,
      uploadedAt: Date.now(),
      size: validation.size,
      hash: createHash('sha256').update(validation.sanitizedContent, 'utf8').digest('hex')
    })

    this.store.set('customSvgs', [...current, entry])
    return customSvgUploadResponseSchema.parse({
      id: entry.id,
      sanitizedContent: entry.sanitizedContent,
      entry
    })
  }

  remove(input: CustomSvgRemoveRequest): CustomSvgRemoveResponse {
    const current = this.readItems()
    const next = current.filter(item => item.id !== input.id)
    this.store.set('customSvgs', next)
    return customSvgRemoveResponseSchema.parse({
      success: next.length !== current.length,
      removed: current.length - next.length,
      remaining: next.length
    })
  }

  private readItems(): CustomSvgEntry[] {
    const raw = this.store.get('customSvgs', [])
    if (!Array.isArray(raw)) return []
    return raw.flatMap(item => {
      const parsed = customSvgEntrySchema.safeParse(item)
      return parsed.success ? [parsed.data] : []
    })
  }
}
