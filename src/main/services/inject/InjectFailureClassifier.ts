import type { InjectFailureKind } from '@shared/schemas/inject'

export interface InjectFailureDiagnosis {
  failureKind: InjectFailureKind
  recommendation: string
  retryable: boolean
}

const FAILURE_DIAGNOSES: Record<InjectFailureKind, InjectFailureDiagnosis> = {
  'window-not-found': {
    failureKind: 'window-not-found',
    recommendation: 'Refresh window inventory and reselect a visible target window.',
    retryable: true
  },
  'window-iconic': {
    failureKind: 'window-iconic',
    recommendation: 'Restore the minimized target window before injecting text.',
    retryable: true
  },
  'no-focus': {
    failureKind: 'no-focus',
    recommendation: 'Bring the target window to foreground and retry with focus verification.',
    retryable: true
  },
  'input-not-ready': {
    failureKind: 'input-not-ready',
    recommendation: 'Wait until the target task reports waiting-input before retrying.',
    retryable: true
  },
  'user-stole-focus': {
    failureKind: 'user-stole-focus',
    recommendation: 'Stop the current injection and ask the operator to confirm focus ownership.',
    retryable: false
  },
  ignored: {
    failureKind: 'ignored',
    recommendation: 'Keep the action cancelled or ignored until the operator schedules a new injection.',
    retryable: false
  },
  'wrong-position': {
    failureKind: 'wrong-position',
    recommendation: 'Revalidate cursor position or input selection before retrying.',
    retryable: true
  },
  'encoding-error': {
    failureKind: 'encoding-error',
    recommendation: 'Normalize text as UTF-8/NFC and retry with bounded chunks.',
    retryable: true
  },
  'rate-limited': {
    failureKind: 'rate-limited',
    recommendation: 'Back off according to the IPC rate-limit bucket before retrying.',
    retryable: true
  },
  'tool-crashed': {
    failureKind: 'tool-crashed',
    recommendation: 'Restart or recover the target tool before replaying the injection.',
    retryable: true
  },
  'clipboard-conflict': {
    failureKind: 'clipboard-conflict',
    recommendation: 'Wait for clipboard ownership to clear, then restore and retry.',
    retryable: true
  },
  permission: {
    failureKind: 'permission',
    recommendation: 'Request explicit operator confirmation or whitelist permission.',
    retryable: false
  },
  'target-not-found': {
    failureKind: 'target-not-found',
    recommendation: 'Resolve the target alias/pid/window handle again before injecting.',
    retryable: true
  },
  'native-disabled': {
    failureKind: 'native-disabled',
    recommendation: 'Enable the native adapter feature flag or select a non-native mode.',
    retryable: false
  },
  'shim-not-installed': {
    failureKind: 'shim-not-installed',
    recommendation: 'Install or repair the matching SHIM control channel before retrying pty mode.',
    retryable: false
  },
  'runtime-error': {
    failureKind: 'runtime-error',
    recommendation: 'Inspect the runtime error and retry only after the boundary cause is fixed.',
    retryable: false
  }
}

export class InjectFailureClassifier {
  classify(error: string | null | undefined): InjectFailureKind {
    return this.diagnose(error).failureKind
  }

  diagnose(error: string | null | undefined): InjectFailureDiagnosis {
    const value = (error ?? '').toLowerCase()
    if (value.includes('window not found') || value.includes('hwnd not found') || value.includes('no such window') || (value.includes('window') && value.includes('not found'))) return FAILURE_DIAGNOSES['window-not-found']
    if (value.includes('iconic') || value.includes('minimized') || value.includes('minimised')) return FAILURE_DIAGNOSES['window-iconic']
    if (value.includes('focus stolen') || value.includes('stole focus') || value.includes('foreground changed') || value.includes('user focus')) return FAILURE_DIAGNOSES['user-stole-focus']
    if (value.includes('no focus') || value.includes('focus denied') || value.includes('foreground')) return FAILURE_DIAGNOSES['no-focus']
    if (value.includes('not ready') || value.includes('waiting-input') || value.includes('input not ready')) return FAILURE_DIAGNOSES['input-not-ready']
    if (value.includes('ignored') || value.includes('cancelled') || value.includes('canceled') || value.includes('no-op')) return FAILURE_DIAGNOSES.ignored
    if (value.includes('wrong position') || value.includes('cursor position') || value.includes('selection mismatch')) return FAILURE_DIAGNOSES['wrong-position']
    if (value.includes('encoding') || value.includes('utf') || value.includes('surrogate')) return FAILURE_DIAGNOSES['encoding-error']
    if (value.includes('rate limit') || value.includes('rate-limited') || value.includes('timeout') || value.includes('throttle')) return FAILURE_DIAGNOSES['rate-limited']
    if (value.includes('crash') || value.includes('exited') || value.includes('terminated')) return FAILURE_DIAGNOSES['tool-crashed']
    if (value.includes('clipboard')) return FAILURE_DIAGNOSES['clipboard-conflict']
    if (value.includes('permission') || value.includes('confirm') || value.includes('whitelist')) return FAILURE_DIAGNOSES.permission
    if (value.includes('shim')) return FAILURE_DIAGNOSES['shim-not-installed']
    if (value.includes('target') || value.includes('alias')) return FAILURE_DIAGNOSES['target-not-found']
    if (value.includes('nut') || value.includes('native')) return FAILURE_DIAGNOSES['native-disabled']
    return FAILURE_DIAGNOSES['runtime-error']
  }
}
