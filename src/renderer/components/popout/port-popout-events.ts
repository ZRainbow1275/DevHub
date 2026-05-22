import type { PortPopoutPosition, PortPopoutTrigger } from './port-popout-model'

export const PORT_POPOUT_REQUEST_EVENT = 'devhub:port-popout-request'
const PORT_POPOUT_REQUEST_TTL_MS = 5000

export interface PortPopoutRequestDetail {
  port: number
  trigger: Extract<PortPopoutTrigger, 'cmdk' | 'api'>
  anchor?: PortPopoutPosition
}

interface PendingPortPopoutRequest {
  detail: PortPopoutRequestDetail
  createdAt: number
}

let pendingPortPopoutRequest: PendingPortPopoutRequest | null = null

function isValidPort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
}

function isValidAnchor(value: unknown): value is PortPopoutPosition {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PortPopoutPosition>
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y)
}

export function isPortPopoutRequestDetail(value: unknown): value is PortPopoutRequestDetail {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PortPopoutRequestDetail>
  if (!isValidPort(candidate.port)) return false
  if (candidate.trigger !== 'cmdk' && candidate.trigger !== 'api') return false
  if (candidate.anchor === undefined) return true
  return isValidAnchor(candidate.anchor)
}

export function createPortPopoutRequestEvent(detail: PortPopoutRequestDetail): CustomEvent<PortPopoutRequestDetail> {
  return new CustomEvent(PORT_POPOUT_REQUEST_EVENT, { detail })
}

export function peekPendingPortPopoutRequest(now = Date.now()): PortPopoutRequestDetail | null {
  if (!pendingPortPopoutRequest) return null
  if (now - pendingPortPopoutRequest.createdAt > PORT_POPOUT_REQUEST_TTL_MS) {
    pendingPortPopoutRequest = null
    return null
  }
  return pendingPortPopoutRequest.detail
}

export function clearPendingPortPopoutRequest(): void {
  pendingPortPopoutRequest = null
}

export function dispatchPortPopoutRequest(detail: PortPopoutRequestDetail): void {
  pendingPortPopoutRequest = {
    detail,
    createdAt: Date.now()
  }
  if (typeof window === 'undefined') return
  window.dispatchEvent(createPortPopoutRequestEvent(detail))
}
