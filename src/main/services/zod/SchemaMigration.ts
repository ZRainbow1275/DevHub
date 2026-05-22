import {
  SCHEMA_VERSION,
  schemaMigrationStepSchema,
  zodMigrationStatusResponseSchema,
  type SchemaMigrationStep,
  type ZodMigrationStatusResponse
} from '@shared/schemas/_meta'

export interface SchemaMigrationOptions {
  readonly currentVersion?: string
  readonly stores?: readonly string[]
  readonly steps?: readonly SchemaMigrationStep[]
  readonly audit?: (event: { schemaName: string; fromVersion: string; toVersion: string; transform: string }) => void
}

export class SchemaMigration {
  private readonly currentVersion: string
  private readonly stores: readonly string[]
  private readonly steps: readonly SchemaMigrationStep[]
  private readonly applied: SchemaMigrationStep[] = []
  private readonly audit?: SchemaMigrationOptions['audit']

  constructor(options: SchemaMigrationOptions = {}) {
    this.currentVersion = options.currentVersion ?? SCHEMA_VERSION
    this.stores = options.stores ?? ['devhub-config', 'devhub-r8-runtime']
    this.steps = (options.steps ?? []).map(step => schemaMigrationStepSchema.parse(step))
    this.audit = options.audit
  }

  status(): ZodMigrationStatusResponse {
    return zodMigrationStatusResponseSchema.parse({
      currentVersion: this.currentVersion,
      checkedAt: Date.now(),
      migratedStores: this.stores,
      pendingMigrations: this.steps.filter(step => !this.applied.includes(step)),
      appliedMigrations: this.applied
    })
  }

  migrateRecord<T extends Record<string, unknown>>(schemaName: string, record: T): { value: T & { schemaVersion: string }; appliedMigrations: SchemaMigrationStep[] } {
    const fromVersion = typeof record.schemaVersion === 'string' ? record.schemaVersion : this.currentVersion
    if (fromVersion === this.currentVersion) {
      return { value: { ...record, schemaVersion: this.currentVersion }, appliedMigrations: [] }
    }

    const step = this.steps.find(candidate =>
      candidate.schemaName === schemaName &&
      candidate.fromVersion === fromVersion &&
      candidate.toVersion === this.currentVersion &&
      candidate.reversible
    )
    if (!step) {
      throw new Error(`E_VALIDATION:NO_REVERSIBLE_MIGRATION:${schemaName}:${fromVersion}->${this.currentVersion}`)
    }

    this.applied.push(step)
    this.audit?.({
      schemaName,
      fromVersion: step.fromVersion,
      toVersion: step.toVersion,
      transform: step.transform
    })

    return {
      value: { ...record, schemaVersion: this.currentVersion },
      appliedMigrations: [step]
    }
  }
}
