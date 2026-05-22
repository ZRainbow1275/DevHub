export interface LogRedactionResult {
  text: string
  redactionCount: number
  ruleCounts: Record<string, number>
}

interface LogRedactionRule {
  id: string
  pattern: RegExp
  replace: string | ((...args: string[]) => string)
}

const LOG_REDACTION_RULES: LogRedactionRule[] = [
  {
    id: 'env-secret-assignment',
    pattern: /\b([A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTHORIZATION)[A-Z0-9_]*)\s*([:=])\s*([^\s"'`;&|]+)/g,
    replace: (_match, key: string, separator: string) => `${key}${separator}[REDACTED]`
  },
  {
    id: 'secret-assignment',
    pattern: /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|token|secret|password|passwd|pwd|credential|authorization)\s*([:=])\s*([^\s"'`;&|]+)/gi,
    replace: (_match, key: string, separator: string) => `${key}${separator}[REDACTED]`
  },
  {
    id: 'bearer-token',
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
    replace: 'Bearer [REDACTED]'
  },
  {
    id: 'openai-style-key',
    pattern: /\bsk-[A-Za-z0-9_-]{8,}\b/g,
    replace: '[REDACTED:api-key]'
  },
  {
    id: 'token-prefix',
    pattern: /\btok-[A-Za-z0-9_-]{6,}\b/g,
    replace: '[REDACTED:token]'
  },
  {
    id: 'github-token',
    pattern: /\bghp_[A-Za-z0-9]{20,}\b/g,
    replace: '[REDACTED:github-token]'
  },
  {
    id: 'aws-access-key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    replace: '[REDACTED:aws-key]'
  },
  {
    id: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replace: '[REDACTED:jwt]'
  },
  {
    id: 'url-credential',
    pattern: /\b(https?:\/\/)([^:\s/@]+):([^@\s/]+)@/gi,
    replace: (_match, protocol: string) => `${protocol}[REDACTED]@`
  }
]

export function redactLogText(text: string): LogRedactionResult {
  let redactedText = text
  let redactionCount = 0
  const ruleCounts: Record<string, number> = {}

  for (const rule of LOG_REDACTION_RULES) {
    redactedText = redactedText.replace(rule.pattern, (...args: string[]) => {
      redactionCount += 1
      ruleCounts[rule.id] = (ruleCounts[rule.id] ?? 0) + 1
      return typeof rule.replace === 'string' ? rule.replace : rule.replace(...args)
    })
  }

  return { text: redactedText, redactionCount, ruleCounts }
}

export function redactLogMessage(message: string): string {
  return redactLogText(message).text
}

export function redactLogEntry<TEntry extends { message: string }>(entry: TEntry): TEntry {
  const message = redactLogMessage(entry.message)
  return message === entry.message ? entry : { ...entry, message }
}
