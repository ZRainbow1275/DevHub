declare module 'wmi-client' {
  const moduleValue: unknown
  export default moduleValue
}

declare module 'sudo-prompt' {
  export interface SudoPromptOptions { name?: string; icns?: string }
  export function exec(command: string, options: SudoPromptOptions, callback: (error?: Error | null, stdout?: string | Buffer, stderr?: string | Buffer) => void): void
}

declare module 'node-window-manager' {
  const moduleValue: unknown
  export default moduleValue
}

declare module 'win32-displayconfig' {
  const moduleValue: unknown
  export default moduleValue
}

declare module 'cytoscape-dagre' {
  import type cytoscape from 'cytoscape'
  const dagre: cytoscape.Ext
  export default dagre
}
