const SECRET_ASSIGNMENT_PATTERN = /\b(api[_-]?key|token|secret|password|pwd)\s*[:=]\s*([^\s"'`;&|]+)/gi
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi
const OPENAI_KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{8,}\b/g
const AWS_ACCESS_KEY_PATTERN = /\bAKIA[0-9A-Z]{16}\b/g
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g

export function redactWindowTitle(title: string): string {
  return title
    .replace(SECRET_ASSIGNMENT_PATTERN, (_match, key: string) => `${key}=[REDACTED]`)
    .replace(BEARER_TOKEN_PATTERN, 'Bearer [REDACTED]')
    .replace(OPENAI_KEY_PATTERN, 'sk-[REDACTED]')
    .replace(AWS_ACCESS_KEY_PATTERN, 'AKIA[REDACTED]')
    .replace(JWT_PATTERN, '[REDACTED_JWT]')
}
