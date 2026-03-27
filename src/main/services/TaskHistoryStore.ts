import { EventEmitter } from 'events'
import Store from 'electron-store'
import {
  TaskRecord,
  TaskStatistics,
  TaskType,
  TaskRecordStatus
} from '@shared/types-extended'

interface TaskHistoryData {
  records: TaskRecord[]
  lastCleanup: string
}

const schema = {
  records: {
    type: 'array' as const,
    default: []
  },
  lastCleanup: {
    type: 'string' as const,
    default: new Date().toISOString()
  }
}

export class TaskHistoryStore extends EventEmitter {
  private records: TaskRecord[] = []
  private maxRecords: number = 1000
  private store: Store<TaskHistoryData>
  private saveTimeout: NodeJS.Timeout | null = null
  private saveDebounceMs: number = 1000

  constructor(maxRecords?: number) {
    super()
    this.setMaxListeners(20)
    if (maxRecords) {
      this.maxRecords = maxRecords
    }

    this.store = new Store<TaskHistoryData>({
      name: 'devhub-task-history',
      schema
    })

    this.loadFromDisk()
  }

  private loadFromDisk(): void {
    try {
      const savedRecords = this.store.get('records', [])
      this.records = savedRecords.map(r => ({
        ...r,
        startTime: typeof r.startTime === 'number' ? r.startTime : new Date(r.startTime).getTime(),
        endTime: r.endTime ? (typeof r.endTime === 'number' ? r.endTime : new Date(r.endTime).getTime()) : undefined
      }))
    } catch (error) {
      console.error('Failed to load task history:', error)
      this.records = []
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }
    this.saveTimeout = setTimeout(() => {
      this.saveToDisk()
    }, this.saveDebounceMs)
  }

  private saveToDisk(): void {
    try {
      this.store.set('records', this.records)
    } catch (error) {
      console.error('Failed to save task history:', error)
    }
  }

  forceSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    this.saveToDisk()
  }

  addRecord(record: Omit<TaskRecord, 'id'>): TaskRecord {
    const newRecord: TaskRecord = {
      ...record,
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    }

    this.records.unshift(newRecord)

    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(0, this.maxRecords)
    }

    this.emit('record-added', newRecord)
    this.scheduleSave()
    return newRecord
  }

  updateRecord(id: string, updates: Partial<TaskRecord>): TaskRecord | undefined {
    const index = this.records.findIndex(r => r.id === id)
    if (index === -1) return undefined

    const updated = { ...this.records[index], ...updates }

    // Calculate duration if endTime is set
    if (updates.endTime && this.records[index].startTime) {
      updated.duration = updates.endTime - this.records[index].startTime
    }

    this.records[index] = updated
    this.emit('record-updated', updated)
    this.scheduleSave()
    return updated
  }

  completeRecord(id: string, status: TaskRecordStatus = 'completed'): TaskRecord | undefined {
    return this.updateRecord(id, {
      endTime: Date.now(),
      status
    })
  }

  getRecord(id: string): TaskRecord | undefined {
    return this.records.find(r => r.id === id)
  }

  getRecords(options?: {
    type?: TaskType
    projectId?: string
    status?: TaskRecordStatus
    limit?: number
    offset?: number
    startDate?: Date
    endDate?: Date
  }): TaskRecord[] {
    let filtered = [...this.records]

    if (options?.type) {
      filtered = filtered.filter(r => r.type === options.type)
    }

    if (options?.projectId) {
      filtered = filtered.filter(r => r.projectId === options.projectId)
    }

    if (options?.status) {
      filtered = filtered.filter(r => r.status === options.status)
    }

    if (options?.startDate) {
      const startMs = options.startDate.getTime()
      filtered = filtered.filter(r => r.startTime >= startMs)
    }

    if (options?.endDate) {
      const endMs = options.endDate.getTime()
      filtered = filtered.filter(r => r.startTime <= endMs)
    }

    const offset = options?.offset ?? 0
    const limit = options?.limit ?? filtered.length

    return filtered.slice(offset, offset + limit)
  }

  getStatistics(options?: {
    projectId?: string
    startDate?: Date
    endDate?: Date
  }): TaskStatistics {
    const records = this.getRecords(options)

    const completedRecords = records.filter(r => r.duration !== undefined)
    const totalDuration = completedRecords.reduce((sum, r) => sum + (r.duration || 0), 0)

    // By type
    const byType: Record<string, { count: number; avgDuration: number }> = {}
    const typeGroups = this.groupBy(completedRecords, 'type')
    for (const [type, typeRecords] of Object.entries(typeGroups)) {
      const typeDuration = (typeRecords as TaskRecord[]).reduce((sum, r) => sum + (r.duration || 0), 0)
      byType[type] = {
        count: (typeRecords as TaskRecord[]).length,
        avgDuration: (typeRecords as TaskRecord[]).length > 0 ? typeDuration / (typeRecords as TaskRecord[]).length : 0
      }
    }

    // By project
    const byProject: Record<string, { count: number; avgDuration: number }> = {}
    const projectGroups = this.groupBy(completedRecords.filter(r => r.projectId), 'projectId')
    for (const [projectId, projectRecords] of Object.entries(projectGroups)) {
      const projectDuration = (projectRecords as TaskRecord[]).reduce((sum, r) => sum + (r.duration || 0), 0)
      byProject[projectId] = {
        count: (projectRecords as TaskRecord[]).length,
        avgDuration: (projectRecords as TaskRecord[]).length > 0 ? projectDuration / (projectRecords as TaskRecord[]).length : 0
      }
    }

    // By day
    const byDay: { date: string; count: number }[] = []
    const dayGroups = this.groupByDate(records)
    for (const [date, dayRecords] of Object.entries(dayGroups)) {
      byDay.push({ date, count: (dayRecords as TaskRecord[]).length })
    }
    byDay.sort((a, b) => b.date.localeCompare(a.date))

    return {
      totalTasks: records.length,
      totalDuration,
      avgDuration: completedRecords.length > 0 ? totalDuration / completedRecords.length : 0,
      byType,
      byProject,
      byDay: byDay.slice(0, 30)
    }
  }

  clearOldRecords(beforeDate: Date): number {
    const beforeMs = beforeDate.getTime()
    const before = this.records.length
    this.records = this.records.filter(r =>
      r.startTime >= beforeMs
    )
    const removed = before - this.records.length
    if (removed > 0) {
      this.scheduleSave()
    }
    return removed
  }

  private groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
    const result: Record<string, T[]> = {}
    for (const item of items) {
      const groupKey = String(item[key])
      if (!result[groupKey]) {
        result[groupKey] = []
      }
      result[groupKey].push(item)
    }
    return result
  }

  private groupByDate(records: TaskRecord[]): Record<string, TaskRecord[]> {
    const result: Record<string, TaskRecord[]> = {}
    for (const record of records) {
      const date = new Date(record.startTime).toISOString().split('T')[0]
      if (!result[date]) {
        result[date] = []
      }
      result[date].push(record)
    }
    return result
  }

  cleanup(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    this.saveToDisk()
    this.removeAllListeners()
  }
}

let taskHistoryStore: TaskHistoryStore | null = null

export function getTaskHistoryStore(): TaskHistoryStore {
  if (!taskHistoryStore) {
    taskHistoryStore = new TaskHistoryStore()
  }
  return taskHistoryStore
}
