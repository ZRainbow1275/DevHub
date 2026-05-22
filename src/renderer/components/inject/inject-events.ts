export const INJECT_WHITELIST_CHANGED_EVENT = 'devhub:inject-whitelist-changed'

export function dispatchInjectWhitelistChanged(source: string): void {
  window.dispatchEvent(new CustomEvent(INJECT_WHITELIST_CHANGED_EVENT, {
    detail: {
      at: Date.now(),
      source
    }
  }))
}
