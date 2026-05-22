import { describe, expect, it } from 'vitest'
import { R8A_INTEGRATION_MANIFEST, integrationManifestSchema, listEnabledIntegrationPackages } from './integration-manifest'

describe('R8.A integration manifest', () => {
  it('parses the manifest and keeps package and flag ownership unique', () => {
    const manifest = integrationManifestSchema.parse(R8A_INTEGRATION_MANIFEST)
    const packageNames = manifest.libraries.map(library => library.packageName)
    const flags = manifest.libraries.map(library => library.flag)

    expect(new Set(packageNames).size).toBe(packageNames.length)
    expect(new Set(flags).size).toBe(flags.length)
    expect(packageNames).toContain('@nut-tree-fork/nut-js')
    expect(packageNames).toContain('cytoscape')
    expect(packageNames).toContain('cytoscape-dagre')
    expect(flags).toContain('R8.A.libs.react-scan')
    expect(flags).toContain('R8.A.libs.cytoscape')
    expect(flags).toContain('R8.A.libs.cytoscape-dagre')
    expect(flags).toContain('R8.A.libs.license-checker')
  })

  it('documents all non-standard license exceptions explicitly', () => {
    const eplLibraries = R8A_INTEGRATION_MANIFEST.libraries.filter(library => library.license === 'EPL-2.0')

    expect(eplLibraries).toHaveLength(1)
    expect(eplLibraries[0]).toMatchObject({ packageName: 'elkjs' })
    expect(eplLibraries[0].licenseException).toMatch(/EPL-2.0 exception/)
  })

  it('keeps R8.C automation disabled from the enabled package surface', () => {
    const enabledPackages = listEnabledIntegrationPackages()

    expect(enabledPackages).not.toContain('@nut-tree-fork/nut-js')
    expect(enabledPackages).toContain('wmi-client')
    expect(enabledPackages).toContain('cytoscape')
    expect(enabledPackages).toContain('cytoscape-dagre')
    expect(enabledPackages).toContain('license-checker-rseidelsohn')
  })
})
