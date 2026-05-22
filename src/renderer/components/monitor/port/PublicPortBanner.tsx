import { useMemo, useState } from 'react'
import type { PortInfo } from '@shared/types-extended'
import type { BlocklistEntry, SecurityTierClassification } from '@shared/port-security'
import { classifyPortSecurity, isPortBlocklisted } from '@shared/port-security'
import { AlertIcon, CloseIcon, GlobeIcon } from '../../icons'
import { SecurityTierBadge } from './SecurityTierBadge'

interface PublicPortBannerProps {
  ports: readonly PortInfo[]
  blocklistEntries: readonly BlocklistEntry[]
  onReview?: () => void
}

function classifyPorts(ports: readonly PortInfo[], blocklistEntries: readonly BlocklistEntry[]): SecurityTierClassification[] {
  return ports.flatMap(port => {
    try {
      return [classifyPortSecurity({
        port: port.port,
        address: port.localAddress,
        blocklisted: isPortBlocklisted(port.port, port.localAddress, blocklistEntries)
      })]
    } catch {
      return []
    }
  })
}

export function PublicPortBanner({ ports, blocklistEntries, onReview }: PublicPortBannerProps) {
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const summary = useMemo(() => {
    const classifications = classifyPorts(ports, blocklistEntries)
    const wan = classifications.filter(item => item.tier === 'WAN-Capable')
    const suspicious = classifications.filter(item => item.tier === 'Suspicious')
    const key = `${wan.map(item => `${item.ip}:${item.port}`).join('|')}::${suspicious.map(item => `${item.ip}:${item.port}`).join('|')}`
    return { wan, suspicious, key }
  }, [blocklistEntries, ports])

  if (summary.wan.length === 0 && summary.suspicious.length === 0) return null
  if (dismissedKey === summary.key) return null

  return (
    <div
      data-testid="public-port-banner"
      className="mx-5 mt-3 flex items-start justify-between gap-4 border-l-4 border-warning bg-warning/10 px-4 py-3 text-sm text-text-primary radius-sm"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center bg-surface-900 text-warning radius-sm">
          {summary.suspicious.length > 0 ? <AlertIcon size={16} /> : <GlobeIcon size={16} />}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-warning">检测到公网可达或可疑监听端口</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            {summary.wan.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <SecurityTierBadge tier="WAN-Capable" showLabel={false} />
                公网可达 {summary.wan.length} 个
              </span>
            )}
            {summary.suspicious.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <SecurityTierBadge tier="Suspicious" showLabel={false} />
                可疑端口 {summary.suspicious.length} 个
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {onReview && (
          <button
            type="button"
            onClick={onReview}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            查看端口
          </button>
        )}
        <button
          type="button"
          aria-label="关闭端口安全提示"
          onClick={() => setDismissedKey(summary.key)}
          className="btn-icon-sm text-text-muted hover:text-text-primary"
        >
          <CloseIcon size={14} />
        </button>
      </div>
    </div>
  )
}
