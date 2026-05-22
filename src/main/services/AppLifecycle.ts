import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  appLifecycleMarkerSchema,
  type AppLifecycleMarker
} from '@shared/schemas/recovery'

export class AppLifecycle {
  constructor(
    private readonly markerPath: string,
    private readonly bootId: string,
    private readonly now: () => number = () => Date.now(),
    private readonly pid: number = process.pid,
    private readonly appVersion: string | null = null
  ) {}

  readMarker(): AppLifecycleMarker | null {
    try {
      const content = readFileSync(this.markerPath, 'utf8')
      return appLifecycleMarkerSchema.parse(JSON.parse(content))
    } catch {
      return null
    }
  }

  markRunning(): AppLifecycleMarker {
    return this.write('running')
  }

  markCleanShutdown(): AppLifecycleMarker {
    return this.write('clean-shutdown')
  }

  private write(status: AppLifecycleMarker['status']): AppLifecycleMarker {
    const marker = appLifecycleMarkerSchema.parse({
      status,
      pid: this.pid,
      bootId: this.bootId,
      updatedAt: this.now(),
      appVersion: this.appVersion
    })
    mkdirSync(dirname(this.markerPath), { recursive: true })
    writeFileSync(this.markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8')
    return marker
  }
}
