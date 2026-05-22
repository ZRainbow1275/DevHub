import { z } from 'zod'
import type { DashboardWidgetId } from '@shared/schemas/r8-runtime'

export type DashboardWidgetConfigValue = string | number | boolean
export type DashboardWidgetConfig = Record<string, DashboardWidgetConfigValue>

export interface DashboardWidgetConfigOption {
  value: string
  label: string
}

export interface DashboardWidgetConfigField {
  key: string
  label: string
  description: string
  kind: 'boolean' | 'number' | 'select'
  defaultValue: DashboardWidgetConfigValue
  min?: number
  max?: number
  step?: number
  options?: DashboardWidgetConfigOption[]
}

export interface DashboardWidgetConfigDefinition {
  title: string
  fields: DashboardWidgetConfigField[]
}

const maxRowsSchema = z.coerce.number().int().min(1).max(20)
const maxNodesSchema = z.coerce.number().int().min(4).max(24)
const booleanSchema = z.coerce.boolean()
const toneSchema = z.enum(['info', 'warning', 'danger'])
const rangeSchema = z.enum(['1h', '6h', '24h'])

const widgetConfigSchemas = {
  'process-summary': z.object({ maxRows: maxRowsSchema.default(4) }),
  'port-summary': z.object({ maxRows: maxRowsSchema.default(4) }),
  'window-summary': z.object({ maxRows: maxRowsSchema.default(3), visibleOnly: booleanSchema.default(true) }),
  'ai-task-queue': z.object({ maxRows: maxRowsSchema.default(4) }),
  'system-resource': z.object({ showBars: booleanSchema.default(true) }),
  notifications: z.object({ maxRows: maxRowsSchema.default(4), minTone: toneSchema.default('warning') }),
  'topology-mini': z.object({ maxNodes: maxNodesSchema.default(8) }),
  'treemap-mini': z.object({ maxRows: maxRowsSchema.default(8) }),
  'sparkline-cpu': z.object({ range: rangeSchema.default('24h') }),
  'sparkline-rss': z.object({ range: rangeSchema.default('24h') }),
  'recent-uri': z.object({ maxRows: maxRowsSchema.default(6) }),
  favorites: z.object({ maxRows: maxRowsSchema.default(6) }),
  custom: z.object({ title: z.string().min(1).max(80).default('Custom widget') })
} satisfies Record<DashboardWidgetId, z.ZodType<DashboardWidgetConfig>>

export const DASHBOARD_WIDGET_CONFIG_DEFINITIONS = {
  'process-summary': {
    title: '进程汇总设置',
    fields: [
      { key: 'maxRows', label: '显示进程数', description: '按 CPU 使用率排序后的最大行数。', kind: 'number', min: 1, max: 12, step: 1, defaultValue: 4 }
    ]
  },
  'port-summary': {
    title: '端口汇总设置',
    fields: [
      { key: 'maxRows', label: '显示协议数', description: '按端口数量排序后的协议行数。', kind: 'number', min: 1, max: 12, step: 1, defaultValue: 4 }
    ]
  },
  'window-summary': {
    title: '窗口汇总设置',
    fields: [
      { key: 'maxRows', label: '显示窗口数', description: '窗口列表最大行数。', kind: 'number', min: 1, max: 12, step: 1, defaultValue: 3 },
      { key: 'visibleOnly', label: '仅显示可见窗口', description: '关闭后同时列出最小化窗口。', kind: 'boolean', defaultValue: true }
    ]
  },
  'ai-task-queue': {
    title: 'AI 任务设置',
    fields: [
      { key: 'maxRows', label: '显示工具数', description: '按任务数排序后的工具行数。', kind: 'number', min: 1, max: 12, step: 1, defaultValue: 4 }
    ]
  },
  'system-resource': {
    title: '系统资源设置',
    fields: [
      { key: 'showBars', label: '显示资源条', description: '关闭后仅保留 CPU 与内存指标卡。', kind: 'boolean', defaultValue: true }
    ]
  },
  notifications: {
    title: '通知设置',
    fields: [
      { key: 'maxRows', label: '显示徽章数', description: '状态徽章列表最大行数。', kind: 'number', min: 1, max: 12, step: 1, defaultValue: 4 },
      {
        key: 'minTone',
        label: '最低告警级别',
        description: '控制徽章列表从哪个级别开始显示。',
        kind: 'select',
        defaultValue: 'warning',
        options: [
          { value: 'info', label: 'Info 及以上' },
          { value: 'warning', label: 'Warning 及以上' },
          { value: 'danger', label: 'Danger only' }
        ]
      }
    ]
  },
  'topology-mini': {
    title: '拓扑缩略设置',
    fields: [
      { key: 'maxNodes', label: '节点预算', description: '用于压缩显示的节点预算。', kind: 'number', min: 4, max: 24, step: 1, defaultValue: 8 }
    ]
  },
  'treemap-mini': {
    title: '进程 Treemap 设置',
    fields: [
      { key: 'maxRows', label: '显示进程数', description: '按 CPU/RSS 权重排序后的进程行数。', kind: 'number', min: 4, max: 20, step: 1, defaultValue: 8 }
    ]
  },
  'sparkline-cpu': {
    title: 'CPU Sparkline 设置',
    fields: [
      {
        key: 'range',
        label: '时间范围',
        description: '为后续 sparkline widget 保留的真实持久化配置。',
        kind: 'select',
        defaultValue: '24h',
        options: [
          { value: '1h', label: '1h' },
          { value: '6h', label: '6h' },
          { value: '24h', label: '24h' }
        ]
      }
    ]
  },
  'sparkline-rss': {
    title: 'RSS Sparkline 设置',
    fields: [
      {
        key: 'range',
        label: '时间范围',
        description: '为后续 sparkline widget 保留的真实持久化配置。',
        kind: 'select',
        defaultValue: '24h',
        options: [
          { value: '1h', label: '1h' },
          { value: '6h', label: '6h' },
          { value: '24h', label: '24h' }
        ]
      }
    ]
  },
  'recent-uri': {
    title: '最近 URI 设置',
    fields: [
      { key: 'maxRows', label: '显示记录数', description: '最近 URI 记录最大行数。', kind: 'number', min: 1, max: 20, step: 1, defaultValue: 6 }
    ]
  },
  favorites: {
    title: '收藏设置',
    fields: [
      { key: 'maxRows', label: '显示收藏数', description: '收藏入口最大行数。', kind: 'number', min: 1, max: 20, step: 1, defaultValue: 6 }
    ]
  },
  custom: {
    title: '自定义 Widget 设置',
    fields: [
      { key: 'title', label: '标题', description: '自定义 widget 标题。', kind: 'select', defaultValue: 'Custom widget', options: [{ value: 'Custom widget', label: 'Custom widget' }] }
    ]
  }
} satisfies Record<DashboardWidgetId, DashboardWidgetConfigDefinition>

export function parseDashboardWidgetConfig(widgetId: DashboardWidgetId, config: unknown): DashboardWidgetConfig {
  return widgetConfigSchemas[widgetId].parse(config ?? {})
}

export function getDashboardWidgetConfigDefinition(widgetId: DashboardWidgetId): DashboardWidgetConfigDefinition {
  return DASHBOARD_WIDGET_CONFIG_DEFINITIONS[widgetId]
}

export function dashboardConfigNumber(config: DashboardWidgetConfig, key: string, fallback: number): number {
  const value = config[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function dashboardConfigBoolean(config: DashboardWidgetConfig, key: string, fallback: boolean): boolean {
  const value = config[key]
  return typeof value === 'boolean' ? value : fallback
}

export function dashboardConfigString(config: DashboardWidgetConfig, key: string, fallback: string): string {
  const value = config[key]
  return typeof value === 'string' ? value : fallback
}
