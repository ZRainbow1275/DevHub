import type { AIAliasManager } from '../services/AIAliasManager'
import type { AITaskTracker } from '../services/AITaskTracker'
import type { PortScanner } from '../services/PortScanner'
import type { ScannerCache } from '../services/ScannerCache'
import type { SystemProcessScanner } from '../services/SystemProcessScanner'
import type { WindowManager } from '../services/WindowManager'
import type { MetricsCollector } from '../services/observability/MetricsCollector'

export interface SharedMonitorRuntime {
  aiTaskTracker?: AITaskTracker
  aliasManager?: AIAliasManager
  metricsCollector?: MetricsCollector
  portScanner?: PortScanner
  processScanner?: SystemProcessScanner
  scannerCache?: ScannerCache
  windowManager?: WindowManager
}
