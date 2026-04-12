import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { ProcessStatusType, ProcessType, SortConfig, SortColumn } from '@shared/types-extended'
import { SearchIcon, FilterIcon, CloseIcon, ChevronDownIcon } from '../icons'

// ============ Sort Column Labels ============

const SORT_COLUMN_LABELS: Record<SortColumn, string> = {
  name: '名称',
  pid: 'PID',
  cpu: 'CPU',
  memory: '内存',
  port: '端口',
  startTime: '启动时间',
  status: '状态',
  type: '类型'
}

// ============ Status/Type Labels ============

const STATUS_LABELS: Record<ProcessStatusType, string> = {
  running: '运行中',
  idle: '空闲',
  waiting: '等待中',
  unknown: '未知'
}

const STATUS_COLORS: Record<ProcessStatusType, string> = {
  running: 'bg-success',
  idle: 'bg-warning',
  waiting: 'bg-surface-400',
  unknown: 'bg-surface-400'
}

const TYPE_LABELS: Record<ProcessType, string> = {
  'ai-tool': 'AI 工具',
  'dev-server': '开发服务',
  'build': '构建',
  'database': '数据库',
  'other': '其他'
}

// ============ Dropdown Component ============

interface DropdownProps {
  label: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  hasActive?: boolean
}

const Dropdown = memo(function Dropdown({ label, isOpen, onToggle, children, hasActive }: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onToggle()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onToggle])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 text-xs
          border transition-all duration-200
          ${hasActive
            ? 'bg-accent/10 border-accent text-accent'
            : 'bg-surface-800 border-surface-600 text-text-secondary hover:border-surface-500 hover:text-text-primary'
          }
        `}
        style={{ borderRadius: '2px' }}
      >
        {label}
        <ChevronDownIcon size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 min-w-[160px] bg-surface-800 border border-surface-600 shadow-lg z-50 animate-fade-in"
          style={{ borderRadius: '2px' }}
        >
          {children}
        </div>
      )}
    </div>
  )
})

// ============ Sort Indicator ============

interface SortIndicatorProps {
  column: SortColumn
  sortConfigs: SortConfig[]
}

export const SortIndicator = memo(function SortIndicator({ column, sortConfigs }: SortIndicatorProps) {
  const index = sortConfigs.findIndex(s => s.column === column)
  if (index === -1) {
    return <span className="text-text-muted opacity-40 ml-1">↕</span>
  }
  const config = sortConfigs[index]
  const arrow = config.direction === 'asc' ? '↑' : '↓'
  const levelLabel = sortConfigs.length > 1 ? `${index + 1}` : ''
  return (
    <span className="text-accent ml-1 font-mono text-[10px]">
      {arrow}{levelLabel}
    </span>
  )
})

// ============ Main Filter Bar ============

interface ProcessFilterBarProps {
  totalCount: number
  filteredCount: number
  searchQuery: string
  statusFilters: Set<ProcessStatusType>
  typeFilters: Set<ProcessType>
  sortConfigs: SortConfig[]
  onSearchChange: (query: string) => void
  onToggleStatus: (status: ProcessStatusType) => void
  onToggleType: (type: ProcessType) => void
  onClearFilters: () => void
  onClearSort: () => void
}

export const ProcessFilterBar = memo(function ProcessFilterBar({
  totalCount,
  filteredCount,
  searchQuery,
  statusFilters,
  typeFilters,
  sortConfigs,
  onSearchChange,
  onToggleStatus,
  onToggleType,
  onClearFilters,
  onClearSort
}: ProcessFilterBarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSearchChange(value)
    }, 300)
  }, [onSearchChange])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Sync input with external state
  useEffect(() => {
    if (searchRef.current && searchRef.current.value !== searchQuery) {
      searchRef.current.value = searchQuery
    }
  }, [searchQuery])

  const hasFilters = searchQuery.length > 0 || statusFilters.size > 0 || typeFilters.size > 0
  const hasSorts = sortConfigs.length > 0
  const isFiltered = filteredCount !== totalCount

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search Box */}
      <div className="relative flex-1 min-w-[200px] max-w-[400px]">
        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          ref={searchRef}
          type="text"
          placeholder="搜索进程... (pid:1234)"
          defaultValue={searchQuery}
          onChange={handleSearchInput}
          className="w-full pl-8 pr-8 py-1.5 text-xs bg-surface-800 border border-surface-600 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
          style={{ borderRadius: '2px' }}
        />
        {searchQuery && (
          <button
            onClick={() => {
              onSearchChange('')
              if (searchRef.current) searchRef.current.value = ''
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <CloseIcon size={12} />
          </button>
        )}
      </div>

      {/* Status Filter */}
      <Dropdown
        label="状态"
        isOpen={openDropdown === 'status'}
        onToggle={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
        hasActive={statusFilters.size > 0}
      >
        <div className="py-1">
          {(Object.keys(STATUS_LABELS) as ProcessStatusType[]).map(status => (
            <button
              key={status}
              onClick={() => onToggleStatus(status)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-700 transition-colors"
            >
              <span className={`w-3 h-3 flex items-center justify-center border ${statusFilters.has(status) ? 'border-accent bg-accent' : 'border-surface-500'}`} style={{ borderRadius: '2px' }}>
                {statusFilters.has(status) && <span className="text-white text-[8px]">✓</span>}
              </span>
              <span className={`w-2 h-2 ${STATUS_COLORS[status]}`} style={{ borderRadius: '1px' }} />
              <span className="text-text-primary">{STATUS_LABELS[status]}</span>
            </button>
          ))}
        </div>
      </Dropdown>

      {/* Type Filter */}
      <Dropdown
        label="类型"
        isOpen={openDropdown === 'type'}
        onToggle={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
        hasActive={typeFilters.size > 0}
      >
        <div className="py-1">
          {(Object.keys(TYPE_LABELS) as ProcessType[]).map(type => (
            <button
              key={type}
              onClick={() => onToggleType(type)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-700 transition-colors"
            >
              <span className={`w-3 h-3 flex items-center justify-center border ${typeFilters.has(type) ? 'border-accent bg-accent' : 'border-surface-500'}`} style={{ borderRadius: '2px' }}>
                {typeFilters.has(type) && <span className="text-white text-[8px]">✓</span>}
              </span>
              <span className="text-text-primary">{TYPE_LABELS[type]}</span>
            </button>
          ))}
        </div>
      </Dropdown>

      {/* Active Sort Display */}
      {hasSorts && (
        <div className="flex items-center gap-1 text-[10px] text-accent">
          <span className="text-text-muted">排序:</span>
          {sortConfigs.map((s, i) => (
            <span key={s.column} className="bg-accent/10 px-1.5 py-0.5 font-mono" style={{ borderRadius: '2px' }}>
              {SORT_COLUMN_LABELS[s.column]} {s.direction === 'asc' ? '↑' : '↓'}
              {i < sortConfigs.length - 1 && <span className="text-text-muted mx-0.5">→</span>}
            </span>
          ))}
          <button onClick={onClearSort} className="text-text-muted hover:text-error ml-1">
            <CloseIcon size={10} />
          </button>
        </div>
      )}

      {/* Result Count + Clear */}
      <div className="flex items-center gap-2 ml-auto text-[10px]">
        <span className={`font-mono ${isFiltered ? 'text-accent' : 'text-text-muted'}`}>
          {isFiltered ? `${filteredCount} / ${totalCount}` : `${totalCount}`} 个进程
        </span>
        {hasFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1 text-text-muted hover:text-error transition-colors"
          >
            <FilterIcon size={12} />
            <span>清除</span>
          </button>
        )}
      </div>
    </div>
  )
})
