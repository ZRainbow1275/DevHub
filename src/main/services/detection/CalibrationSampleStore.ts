import Store from 'electron-store'
import type { AIToolType, CalibrationSample } from '@shared/types-extended'

interface CalibrationStoreSchema {
  samples: Partial<Record<AIToolType, CalibrationSample[]>>
}

export class CalibrationSampleStore {
  private readonly store: Store<CalibrationStoreSchema>
  private readonly maxSamplesPerTool: number

  constructor(maxSamplesPerTool = 500) {
    this.maxSamplesPerTool = maxSamplesPerTool
    this.store = new Store<CalibrationStoreSchema>({
      name: 'devhub-ai-calibration-samples',
      schema: {
        samples: {
          type: 'object' as const,
          default: {}
        }
      }
    })
  }

  append(sample: CalibrationSample): CalibrationSample[] {
    const samples = this.store.get('samples', {})
    const current = samples[sample.toolType] ?? []
    const next = [...current, sample].slice(-this.maxSamplesPerTool)
    samples[sample.toolType] = next
    this.store.set('samples', samples)
    return next
  }

  list(toolType: AIToolType): CalibrationSample[] {
    return [...(this.store.get('samples', {})[toolType] ?? [])]
  }
}
