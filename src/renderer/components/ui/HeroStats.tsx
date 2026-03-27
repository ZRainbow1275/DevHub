import { useProjectStore } from '../../stores/projectStore'

interface HeroStatProps {
  value: number
  label: string
  variant?: 'default' | 'accent' | 'success' | 'error'
}

function HeroStat({ value, label, variant = 'default' }: HeroStatProps) {
  const variantClass = {
    default: '',
    accent: 'hero-number-accent',
    success: 'hero-number-success',
    error: 'hero-number-error'
  }[variant]

  return (
    <div className={`hero-number ${variantClass}`}>
      <span className="hero-number-value hero-number-update">{value}</span>
      <span className="hero-number-label">{label}</span>
    </div>
  )
}

export function HeroStats() {
  const { projects } = useProjectStore()

  const runningCount = projects.filter(p => p.status === 'running').length
  const errorCount = projects.filter(p => p.status === 'error').length
  const totalPorts = projects.filter(p => p.port).length

  return (
    <div className="flex items-stretch border-b-2 border-surface-700">
      <HeroStat
        value={runningCount}
        label="运行中"
        variant={runningCount > 0 ? 'success' : 'default'}
      />
      <HeroStat
        value={totalPorts}
        label="端口占用"
        variant={totalPorts > 0 ? 'accent' : 'default'}
      />
      <HeroStat
        value={errorCount}
        label="错误"
        variant={errorCount > 0 ? 'error' : 'default'}
      />
    </div>
  )
}
