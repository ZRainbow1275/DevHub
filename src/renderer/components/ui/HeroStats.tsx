import { useProjectStore } from '../../stores/projectStore'
import { useScannerStore } from '../../stores/scannerStore'

interface HeroStatProps {
  value: number
  label: string
  delta?: number
  variant?: 'default' | 'accent' | 'success' | 'error'
}

/**
 * Auto-scale font size based on digit count.
 * 5+ digits get progressively smaller.
 */
function getValueFontSize(value: number): string {
  const digits = String(value).length
  if (digits >= 6) return '18px'
  if (digits >= 5) return '22px'
  if (digits >= 4) return '26px'
  return '32px'
}

function HeroStat({ value, label, delta, variant = 'default' }: HeroStatProps) {
  const borderColor = {
    default: 'var(--surface-600)',
    accent: 'var(--gold-500)',
    success: 'var(--success)',
    error: 'var(--error)'
  }[variant]

  return (
    <div
      className="hero-stat-card flex items-center gap-2 px-3 py-2 min-w-0"
      style={{
        borderBottom: `2px solid ${borderColor}`,
        background: variant !== 'default' ? `color-mix(in srgb, ${borderColor} 5%, transparent)` : undefined
      }}
    >
      <span
        className="hero-stat-value font-bold text-text-primary tabular-nums flex-shrink-0"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: getValueFontSize(value),
          lineHeight: 1.1,
          letterSpacing: 'var(--typo-heading-spacing, 0.05em)'
        }}
      >
        {value.toLocaleString()}
      </span>
      {delta !== undefined && delta !== 0 && (
        <span className={`text-[10px] flex-shrink-0 ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
          ({delta > 0 ? '+' : ''}{delta})
        </span>
      )}
      <span
        className="hero-stat-label text-xs text-text-muted whitespace-nowrap flex-shrink-0"
        style={{
          textTransform: 'uppercase' as const,
          letterSpacing: 'var(--typo-heading-spacing, 0.1em)'
        }}
      >
        {label}
      </span>
    </div>
  )
}

export function HeroStats() {
  const projects = useProjectStore(s => s.projects)
  const summary = useScannerStore(s => s.summary)
  const summaryDelta = useScannerStore(s => s.summaryDelta)
  const initStatus = useScannerStore(s => s.initStatus)

  const runningCount = projects.filter(p => p.status === 'running').length
  const errorCount = projects.filter(p => p.status === 'error').length

  // Use scanner summary for system-level metrics when available
  const useScannerData = initStatus !== 'loading'
  const processCount = useScannerData ? summary.processCount : 0
  const portCount = useScannerData ? summary.activePortCount : projects.filter(p => p.port).length
  const aiToolCount = useScannerData ? summary.aiToolCount : 0

  return (
    <div className="panel-container border-b-2 border-surface-700">
      <div
        className="hero-stats-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 0
        }}
      >
        <HeroStat
          value={runningCount}
          label="运行中"
          variant={runningCount > 0 ? 'success' : 'default'}
        />
        <HeroStat
          value={processCount}
          label="进程"
          delta={summaryDelta.processCount}
          variant={processCount > 0 ? 'accent' : 'default'}
        />
        <HeroStat
          value={portCount}
          label="端口"
          delta={summaryDelta.activePortCount}
          variant={portCount > 0 ? 'accent' : 'default'}
        />
        {aiToolCount > 0 && (
          <HeroStat
            value={aiToolCount}
            label="AI 工具"
            delta={summaryDelta.aiToolCount}
            variant="success"
          />
        )}
        <HeroStat
          value={errorCount}
          label="错误"
          variant={errorCount > 0 ? 'error' : 'default'}
        />
      </div>
    </div>
  )
}
