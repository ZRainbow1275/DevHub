import { z } from 'zod'
import { R8A_FEATURE_FLAGS, featureFlagNameSchema } from './feature-flags'

export const integrationLicenseSchema = z.enum(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'MPL-2.0', 'EPL-2.0'])

export const integrationLibrarySchema = z.object({
  name: z.string().min(1),
  packageName: z.string().min(1),
  installedVersion: z.string().regex(/^\^?[0-9]+\.[0-9]+\.[0-9]+/),
  purpose: z.string().min(8),
  license: integrationLicenseSchema,
  dependencyBlock: z.enum(['dependencies', 'devDependencies']),
  flag: featureFlagNameSchema,
  fallback: z.string().nullable(),
  requiredInBatch: z.literal('R8.A'),
  enabledByDefault: z.boolean(),
  licenseException: z.string().nullable().default(null)
})

export const integrationManifestSchema = z.object({
  generation: z.literal('R8.A'),
  generatedAt: z.string().datetime(),
  libraries: z.array(integrationLibrarySchema).superRefine((libraries, context) => {
    const knownFlags = new Set(R8A_FEATURE_FLAGS.map(flag => flag.name))
    const packageNames = new Set<string>()
    const manifestFlags = new Set<string>()
    for (const library of libraries) {
      if (!knownFlags.has(library.flag)) context.addIssue({ code: 'custom', message: `Unknown feature flag: ${library.flag}` })
      if (packageNames.has(library.packageName)) context.addIssue({ code: 'custom', message: `Duplicate integration package: ${library.packageName}` })
      if (manifestFlags.has(library.flag)) context.addIssue({ code: 'custom', message: `Duplicate integration flag: ${library.flag}` })
      if (library.license === 'EPL-2.0' && !library.licenseException) context.addIssue({ code: 'custom', message: `${library.name} requires EPL exception` })
      packageNames.add(library.packageName)
      manifestFlags.add(library.flag)
    }
  })
})

export type IntegrationLibrary = z.infer<typeof integrationLibrarySchema>
export type IntegrationManifest = z.infer<typeof integrationManifestSchema>

type LibraryTuple = readonly [
  name: string,
  packageName: string,
  installedVersion: string,
  license: z.infer<typeof integrationLicenseSchema>,
  dependencyBlock: 'dependencies' | 'devDependencies',
  flag: z.infer<typeof featureFlagNameSchema>,
  fallback: string | null,
  enabledByDefault: boolean,
  purpose: string,
  licenseException?: string | null
]

const LIBRARIES: readonly LibraryTuple[] = [
  ['wmi-client', 'wmi-client', '^0.5.0', 'MIT', 'dependencies', 'R8.A.libs.wmi-client', 'PowerShellGateway', true, 'Node WMI process data access.'],
  ['systeminformation', 'systeminformation', '^5.31.6', 'MIT', 'dependencies', 'R8.A.libs.systeminformation', 'netstat -ano', true, 'Cross-platform network connection and process inventory for topology sources.'],
  ['sudo-prompt', 'sudo-prompt', '^9.2.1', 'MIT', 'dependencies', 'R8.A.libs.sudo-prompt', 'AdminRelaunch', true, 'Windows UAC one-shot spawn.'],
  ['tree-kill', 'tree-kill', '^1.2.2', 'MIT', 'dependencies', 'R8.A.libs.tree-kill', 'SafeTaskKill', true, 'Recursive process-tree termination.'],
  ['node-window-manager', 'node-window-manager', '^2.2.4', 'MIT', 'dependencies', 'R8.A.libs.node-window-manager', 'WindowManager PowerShell helper', true, 'Native window control adapter.'],
  ['koffi', 'koffi', '^2.16.1', 'MIT', 'dependencies', 'R8.A.libs.koffi', null, true, 'Win32 FFI adapter.'],
  ['win32-displayconfig', 'win32-displayconfig', '^0.1.0', 'MIT', 'dependencies', 'R8.A.libs.win32-displayconfig', 'Electron screen API', true, 'Display and DPI metadata adapter.'],
  ['nut-js', '@nut-tree-fork/nut-js', '^4.2.6', 'Apache-2.0', 'dependencies', 'R8.A.libs.nut-js', 'WINDOW_SEND_KEYS', false, 'Keyboard and mouse automation reserved for R8.C.'],
  ['node-pty', 'node-pty', '^1.1.0', 'MIT', 'dependencies', 'R8.A.libs.node-pty', 'child_process', true, 'Pseudo terminal adapter.'],
  ['@xyflow/react', '@xyflow/react', '^12.10.2', 'MIT', 'dependencies', 'R8.A.libs.xyflow', 'NeuralGraphEngine', true, 'Graph rendering engine.'],
  ['cytoscape', 'cytoscape', '^3.33.3', 'MIT', 'dependencies', 'R8.A.libs.cytoscape', 'NeuralGraphWithControls', true, 'Shared browser graph renderer for DAG and topology canvases.'],
  ['cytoscape-dagre', 'cytoscape-dagre', '^3.0.0', 'MIT', 'dependencies', 'R8.A.libs.cytoscape-dagre', '@dagrejs/dagre', true, 'Cytoscape layered graph layout extension.'],
  ['d3-force', 'd3-force', '^3.0.0', 'ISC', 'dependencies', 'R8.A.libs.d3-force', null, true, 'Force-directed graph layout.'],
  ['@dagrejs/dagre', '@dagrejs/dagre', '^3.0.0', 'MIT', 'dependencies', 'R8.A.libs.dagre', null, true, 'Layered graph layout.'],
  ['elkjs', 'elkjs', '^0.11.1', 'EPL-2.0', 'dependencies', 'R8.A.libs.elkjs', 'dagre', true, 'Precise layered graph layout.', 'R8.A approved explicit EPL-2.0 exception for layout-only usage.'],
  ['webcola', 'webcola', '^3.4.0', 'MIT', 'dependencies', 'R8.A.libs.webcola', null, true, 'Constrained graph layout.'],
  ['cmdk', 'cmdk', '^1.1.1', 'MIT', 'dependencies', 'R8.A.libs.cmdk', null, true, 'Command palette primitive.'],
  ['react-resizable-panels', 'react-resizable-panels', '^4.11.0', 'MIT', 'dependencies', 'R8.A.libs.resizable-panels', null, true, 'Resizable panel primitive.'],
  ['@radix-ui/react-dialog', '@radix-ui/react-dialog', '^1.1.15', 'MIT', 'dependencies', 'R8.A.libs.radix-dialog', null, true, 'Accessible dialog primitive.'],
  ['@radix-ui/react-dropdown-menu', '@radix-ui/react-dropdown-menu', '^2.1.16', 'MIT', 'dependencies', 'R8.A.libs.radix-dropdown', null, true, 'Accessible dropdown primitive.'],
  ['@radix-ui/react-tooltip', '@radix-ui/react-tooltip', '^1.2.8', 'MIT', 'dependencies', 'R8.A.libs.radix-tooltip', null, true, 'Accessible tooltip primitive.'],
  ['react-grid-layout', 'react-grid-layout', '^2.2.3', 'MIT', 'dependencies', 'R8.A.libs.grid-layout', null, true, 'Dashboard grid layout primitive.'],
  ['@tanstack/react-table', '@tanstack/react-table', '^8.21.3', 'MIT', 'dependencies', 'R8.A.libs.tanstack-table', null, true, 'Dense table primitive.'],
  ['@tanstack/react-virtual', '@tanstack/react-virtual', '^3.13.18', 'MIT', 'dependencies', 'R8.A.libs.tanstack-virtual', null, true, 'Virtual list primitive.'],
  ['react-arborist', 'react-arborist', '^3.5.0', 'MIT', 'dependencies', 'R8.A.libs.arborist', null, true, 'Tree view primitive.'],
  ['framer-motion', 'framer-motion', '^12.38.0', 'MIT', 'dependencies', 'R8.A.libs.framer-motion', 'CSS transitions', true, 'Motion primitive.'],
  ['react-hook-form', 'react-hook-form', '^7.75.0', 'MIT', 'dependencies', 'R8.A.libs.react-hook-form', null, true, 'Typed form primitive.'],
  ['date-fns', 'date-fns', '^4.1.0', 'MIT', 'dependencies', 'R8.A.libs.date-fns', 'Intl.DateTimeFormat', true, 'Date formatting utility.'],
  ['lucide-react', 'lucide-react', '^1.14.0', 'ISC', 'dependencies', 'R8.A.libs.lucide', null, true, 'Non-emoji icon source.'],
  ['@tabler/icons-react', '@tabler/icons-react', '^3.41.1', 'MIT', 'dependencies', 'R8.A.libs.tabler', null, true, 'Non-emoji technical icon source.'],
  ['@radix-ui/react-icons', '@radix-ui/react-icons', '^1.3.2', 'MIT', 'dependencies', 'R8.A.libs.radix-icons', null, true, 'Non-emoji primitive icon source.'],
  ['@heroicons/react', '@heroicons/react', '^2.2.0', 'MIT', 'dependencies', 'R8.A.libs.heroicons', null, true, 'Non-emoji icon source.'],
  ['react-scan', 'react-scan', '^0.5.6', 'MIT', 'devDependencies', 'R8.A.libs.react-scan', null, false, 'Development render performance inspection.'],
  ['license-checker-rseidelsohn', 'license-checker-rseidelsohn', '^4.4.2', 'BSD-3-Clause', 'devDependencies', 'R8.A.libs.license-checker', 'pnpm licenses list', true, 'Dependency license validation.']
]

export const R8A_INTEGRATION_MANIFEST = integrationManifestSchema.parse({
  generation: 'R8.A',
  generatedAt: '2026-05-03T00:00:00.000Z',
  libraries: LIBRARIES.map(([name, packageName, installedVersion, license, dependencyBlock, flag, fallback, enabledByDefault, purpose, licenseException]) => ({
    name,
    packageName,
    installedVersion,
    license,
    dependencyBlock,
    flag,
    fallback,
    requiredInBatch: 'R8.A',
    enabledByDefault,
    purpose,
    licenseException: licenseException ?? null
  }))
})

export function listEnabledIntegrationPackages(manifest: IntegrationManifest = R8A_INTEGRATION_MANIFEST): string[] {
  return manifest.libraries.filter(library => library.enabledByDefault).map(library => library.packageName)
}
