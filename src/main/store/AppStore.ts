import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'
import {
  Project,
  CodingTool,
  AppConfig,
  AppSettings,
  DEFAULT_TOOLS,
  DEFAULT_SETTINGS,
  migrateSettings,
  deepMergeSettings
} from '@shared/types'
import { guardProtoPollution } from '../utils/validation'

// ============ Local Type Guards ============

/**
 * Validates that a value is a plain settings-like object (non-null, non-array).
 * Used as runtime gate before calling migrateSettings which operates on
 * Record<string, unknown>.
 */
function isSettingsObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Validates persisted windowBounds shape before returning to caller.
 * Required fields: x, y, width, height — all finite numbers.
 */
function isWindowBounds(v: unknown): v is { x: number; y: number; width: number; height: number } {
  if (!v || typeof v !== 'object') return false
  const b = v as Record<string, unknown>
  return typeof b.x === 'number' && Number.isFinite(b.x)
    && typeof b.y === 'number' && Number.isFinite(b.y)
    && typeof b.width === 'number' && Number.isFinite(b.width)
    && typeof b.height === 'number' && Number.isFinite(b.height)
}

const schema = {
  projects: {
    type: 'array' as const,
    default: []
  },
  tools: {
    type: 'array' as const,
    default: DEFAULT_TOOLS
  },
  tags: {
    type: 'array' as const,
    default: []
  },
  groups: {
    type: 'array' as const,
    default: []
  },
  settings: {
    type: 'object' as const,
    default: DEFAULT_SETTINGS
  }
}

export class AppStore {
  private store: Store<AppConfig>
  private _cache: { projects?: Project[]; settings?: AppSettings } = {}

  constructor() {
    this.store = new Store<AppConfig>({
      name: 'devhub-config',
      schema
    })
  }

  private invalidateCache(key?: 'projects' | 'settings'): void {
    if (key) {
      delete this._cache[key]
    } else {
      this._cache = {}
    }
  }

  // Projects
  getProjects(): Project[] {
    if (this._cache.projects) return this._cache.projects
    const projects = this.store.get('projects', [])
    // Backward compatibility: ensure all projects have projectType
    let needsPersist = false
    for (const project of projects) {
      if (!project.projectType) {
        (project as Project).projectType = 'npm'
        needsPersist = true
      }
    }
    if (needsPersist) {
      this.store.set('projects', projects)
    }
    this._cache.projects = projects
    return projects
  }

  getProject(id: string): Project | undefined {
    return this.getProjects().find((p) => p.id === id)
  }

  addProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
    const now = Date.now()
    const newProject: Project = {
      ...project,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    }

    const projects = this.getProjects()
    projects.push(newProject)
    this.store.set('projects', projects)
    this.invalidateCache('projects')

    return newProject
  }

  updateProject(id: string, updates: Partial<Project>): Project | undefined {
    const projects = this.getProjects()
    const index = projects.findIndex((p) => p.id === id)

    if (index === -1) return undefined

    guardProtoPollution(updates)

    // Destructure out immutable fields
    const {
      id: _id,
      createdAt: _createdAt,
      ...safeUpdates
    } = updates

    projects[index] = {
      ...projects[index],
      ...safeUpdates,
      updatedAt: Date.now()
    }

    this.store.set('projects', projects)
    this.invalidateCache('projects')
    return projects[index]
  }

  removeProject(id: string): boolean {
    const projects = this.getProjects()
    const filtered = projects.filter((p) => p.id !== id)

    if (filtered.length === projects.length) return false

    this.store.set('projects', filtered)
    this.invalidateCache('projects')
    return true
  }

  // Tags
  getTags(): string[] {
    return this.store.get('tags', [])
  }

  addTag(tag: string): void {
    const tags = this.getTags()
    if (!tags.includes(tag)) {
      tags.push(tag)
      this.store.set('tags', tags)
    }
  }

  removeTag(tag: string): void {
    const tags = this.getTags().filter((t) => t !== tag)
    this.store.set('tags', tags)
  }

  // Groups
  getGroups(): string[] {
    return this.store.get('groups', [])
  }

  addGroup(group: string): void {
    const groups = this.getGroups()
    if (!groups.includes(group)) {
      groups.push(group)
      this.store.set('groups', groups)
    }
  }

  removeGroup(group: string): void {
    const groups = this.getGroups().filter((g) => g !== group)
    this.store.set('groups', groups)
  }

  // Tools
  getTools(): CodingTool[] {
    return this.store.get('tools', DEFAULT_TOOLS)
  }

  updateTool(id: string, updates: Partial<CodingTool>): void {
    const tools = this.getTools()
    const index = tools.findIndex((t) => t.id === id)

    if (index !== -1) {
      guardProtoPollution(updates)

      // Field whitelist
      const ALLOWED_FIELDS: (keyof CodingTool)[] = [
        'displayName', 'processName', 'completionPatterns', 'status', 'lastRunAt', 'lastCompletedAt'
      ]
      const safeUpdates: Partial<CodingTool> = {}
      for (const key of ALLOWED_FIELDS) {
        if (key in updates) {
          ;(safeUpdates as Record<string, unknown>)[key] = (updates as Record<string, unknown>)[key]
        }
      }

      tools[index] = { ...tools[index], ...safeUpdates }
      this.store.set('tools', tools)
    }
  }

  // Settings
  getSettings(): AppSettings {
    if (this._cache.settings) return this._cache.settings
    const rawValue = this.store.get('settings', DEFAULT_SETTINGS)
    const raw: Record<string, unknown> = isSettingsObject(rawValue)
      ? rawValue
      : (DEFAULT_SETTINGS as unknown as Record<string, unknown>)
    // Migrate from legacy flat format if necessary
    const migrated = migrateSettings(raw)
    // Persist migrated settings if migration occurred (old flat format detected)
    if (typeof raw.theme === 'string' && raw.appearance === undefined) {
      this.store.set('settings', migrated)
    }
    this._cache.settings = migrated
    return migrated
  }

  updateSettings(updates: Partial<AppSettings>): void {
    const settings = this.getSettings()
    const merged = deepMergeSettings(settings, updates)
    this.store.set('settings', merged)
    this.invalidateCache('settings')
  }

  // Window bounds persistence (for saveLayoutOnExit)
  saveBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.store.set('windowBounds', bounds)
  }

  getBounds(): { x: number; y: number; width: number; height: number } | undefined {
    // electron-store's typed Store<AppConfig> doesn't know about 'windowBounds'
    // (it's written ad-hoc via saveBounds and is not part of the schema).
    // We cast to a loose Store to access the untyped key, then the
    // isWindowBounds guard validates the shape at runtime — so this is no
    // longer a bare cast: every value returned is guard-verified.
    const raw = (this.store as unknown as Store<Record<string, unknown>>).get('windowBounds')
    return isWindowBounds(raw) ? raw : undefined
  }

  // Allowed paths management
  addAllowedPath(path: string): void {
    const settings = this.getSettings()
    if (!settings.scan.allowedPaths.includes(path)) {
      settings.scan.allowedPaths.push(path)
      this.store.set('settings', settings)
      this.invalidateCache('settings')
    }
  }

  removeAllowedPath(path: string): void {
    const settings = this.getSettings()
    settings.scan.allowedPaths = settings.scan.allowedPaths.filter((p) => p !== path)
    this.store.set('settings', settings)
    this.invalidateCache('settings')
  }
}
