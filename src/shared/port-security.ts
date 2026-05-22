export const SECURITY_TIER_VALUES = ['Local', 'LAN', 'WAN-Capable', 'Suspicious'] as const

export type SecurityTierLevel = typeof SECURITY_TIER_VALUES[number]
export type SecurityTierTone = 'success' | 'warning' | 'orange' | 'error'

export interface SecurityTierVisual {
  tone: SecurityTierTone
  iconToken: string
  label: string
}

export interface SecurityTierClassification {
  tier: SecurityTierLevel
  score: number
  reasons: string[]
  port: number
  ip: string
  tone: SecurityTierTone
  label: string
  iconToken: string
}

export interface BlocklistEntry {
  id: string
  ip?: string
  port?: number
  reason: string
  source: 'default' | 'user'
  addedAt: number
  createdAt: number
}

export const SECURITY_TIER_VISUAL: Record<SecurityTierLevel, SecurityTierVisual> = {
  Local: { tone: 'success', iconToken: 'ShieldCheck', label: '本机' },
  LAN: { tone: 'warning', iconToken: 'Shield', label: '局域网' },
  'WAN-Capable': { tone: 'orange', iconToken: 'ShieldAlert', label: '公网可达' },
  Suspicious: { tone: 'error', iconToken: 'ShieldX', label: '可疑端口' }
} as const

export const DEFAULT_SUSPICIOUS_PORTS = [
  4444, 6666, 6667, 31337, 1337, 12345, 27374, 31415, 54321, 65535,
  3127, 5800, 5900, 9999, 8888, 7777, 6969, 1080, 8081, 9050,
  1433, 1521, 3306, 3389, 5432, 5984, 11211, 27017, 6379, 9200
] as const

export const SECURITY_TIER_LIMITS = {
  USER_BLOCKLIST_MAX: 500,
  BANNER_MIN_PORTS: 1,
  RECLASSIFY_INTERVAL_MS: 5000
} as const

const DEFAULT_SUSPICIOUS_PORT_SET = new Set<number>(DEFAULT_SUSPICIOUS_PORTS)

function normalizeBracketedIpv6(address: string): string {
  return address.startsWith('[') && address.endsWith(']') ? address.slice(1, -1) : address
}

export function normalizePortSecurityAddress(address: string | undefined): string {
  const trimmed = (address ?? '').trim()
  if (trimmed.length === 0) return '127.0.0.1'
  return normalizeBracketedIpv6(trimmed).toLowerCase()
}

export function isLoopbackAddress(address: string): boolean {
  const normalized = normalizePortSecurityAddress(address)
  return normalized === 'localhost' || normalized === '::1' || normalized.startsWith('127.')
}

export function isWildcardAddress(address: string): boolean {
  const normalized = normalizePortSecurityAddress(address)
  return normalized === '0.0.0.0' || normalized === '::' || normalized === '*' || normalized === 'any'
}

export function isLanAddress(address: string): boolean {
  const normalized = normalizePortSecurityAddress(address)
  const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const octets = ipv4.slice(1).map(value => Number(value))
    if (octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false
    const [first, second] = octets
    return first === 10
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 169 && second === 254)
  }
  return normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')
}

function visualForTier(tier: SecurityTierLevel): SecurityTierVisual {
  return SECURITY_TIER_VISUAL[tier]
}

function scoreForTier(tier: SecurityTierLevel): number {
  if (tier === 'Local') return 10
  if (tier === 'LAN') return 35
  if (tier === 'WAN-Capable') return 70
  return 95
}

export function buildDefaultBlocklistEntries(now = 0): BlocklistEntry[] {
  return DEFAULT_SUSPICIOUS_PORTS.map(port => ({
    id: `default-port-${port}`,
    port,
    reason: 'default suspicious port',
    source: 'default',
    addedAt: now,
    createdAt: now
  }))
}

export function isPortBlocklisted(port: number, address: string | undefined, entries: readonly BlocklistEntry[]): boolean {
  const normalizedAddress = normalizePortSecurityAddress(address)
  return entries.some(entry => {
    if (typeof entry.port === 'number' && entry.port === port) return true
    return typeof entry.ip === 'string' && normalizePortSecurityAddress(entry.ip) === normalizedAddress
  })
}

export function classifyPortSecurity(input: {
  port: number
  address?: string
  blocklisted?: boolean
}): SecurityTierClassification {
  const port = Math.trunc(Number(input.port))
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('E_VALIDATION:port must be an integer between 1 and 65535')
  }

  const ip = normalizePortSecurityAddress(input.address)
  const defaultSuspicious = DEFAULT_SUSPICIOUS_PORT_SET.has(port)
  const blocklisted = Boolean(input.blocklisted) || defaultSuspicious
  const reasons: string[] = []

  let tier: SecurityTierLevel
  if (blocklisted) {
    tier = 'Suspicious'
    reasons.push(defaultSuspicious ? 'default-suspicious-port' : 'user-blocklist')
  } else if (isLoopbackAddress(ip)) {
    tier = 'Local'
    reasons.push('loopback-bind-address')
  } else if (isLanAddress(ip)) {
    tier = 'LAN'
    reasons.push('private-lan-bind-address')
  } else {
    tier = 'WAN-Capable'
    reasons.push(isWildcardAddress(ip) ? 'wildcard-bind-address' : 'public-bind-address')
  }

  const visual = visualForTier(tier)
  return {
    tier,
    score: scoreForTier(tier),
    reasons,
    port,
    ip,
    tone: visual.tone,
    label: visual.label,
    iconToken: visual.iconToken
  }
}
