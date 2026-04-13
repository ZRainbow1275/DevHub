import { useProjectStore } from '../../stores/projectStore'
import { useScannerStore } from '../../stores/scannerStore'
import { ResponsiveMetric } from './ResponsiveMetric'

interface HeroStatProps {
  value: number
  label: string
  delta?: number
  variant?: 'default' | 'accent' | 'success' | 'error'
}

function HeroStat({ value, label, delta, variant = 'default' }: HeroStatProps) {
  const variantClass = {
    default: '',
    accent: 'hero-number-accent',
    success: 'hero-number-success',
    error: 'hero-number-error'
  }[variant]

  return (
    <div className={`hero-number ${variantClass} min-w-0 flex-1`}>
      <span className="hero-number-value hero-number-update">
        <ResponsiveMetric value={value} format="number" variant="hero" />
      </span>
      {delta !== undefined && delta !== 0 && (
        <span className={`text-xs ml-1 ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
          ({delta > 0 ? '+' : ''}{delta})
        </span>
      )}
      <span className="hero-number-label">{label}</span>
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
      <div className="hero-stats-grid">
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
