import type { DagSnapshot } from '@shared/schemas/dag'

export class DagSerializer {
  serialize(snapshot: DagSnapshot, format: 'dot' | 'mermaid' | 'cytoscape'): string {
    if (format === 'dot') return this.toDot(snapshot)
    if (format === 'cytoscape') return this.toCytoscape(snapshot)
    return this.toMermaid(snapshot)
  }

  mimeType(format: 'dot' | 'mermaid' | 'cytoscape'): string {
    if (format === 'dot') return 'text/vnd.graphviz'
    if (format === 'cytoscape') return 'application/vnd.cytoscape+json'
    return 'text/vnd.mermaid'
  }

  private toMermaid(snapshot: DagSnapshot): string {
    const lines = ['graph TD']
    for (const node of snapshot.nodes) {
      const id = this.mermaidId(node.taskId)
      const label = [node.taskId, `p=${node.priority}`, node.parallelGroup ? `group=${node.parallelGroup}` : null, node.isCriticalPath ? 'critical' : null].filter(Boolean).join(' ')
      lines.push(`  ${id}["${this.escapeMermaidLabel(label)}"]`)
    }
    for (const edge of snapshot.edges) {
      const label = edge.condition === 'success' ? '' : `|${edge.condition}|`
      lines.push(`  ${this.mermaidId(edge.from)} -->${label} ${this.mermaidId(edge.to)}`)
    }
    return `${lines.join('\n')}\n`
  }

  private toDot(snapshot: DagSnapshot): string {
    const lines = ['digraph Dag {', '  rankdir=TB;']
    for (const node of snapshot.nodes) {
      const attrs = [`label="${this.escapeDot(node.taskId)}"`, `priority="${node.priority}"`, `layer="${node.layer}"`]
      if (node.parallelGroup) attrs.push(`parallelGroup="${this.escapeDot(node.parallelGroup)}"`)
      if (node.isCriticalPath) attrs.push('color="red"')
      lines.push(`  "${this.escapeDot(node.taskId)}" [${attrs.join(', ')}];`)
    }
    for (const edge of snapshot.edges) {
      lines.push(`  "${this.escapeDot(edge.from)}" -> "${this.escapeDot(edge.to)}" [label="${edge.condition}"];`)
    }
    lines.push('}')
    return `${lines.join('\n')}\n`
  }

  private toCytoscape(snapshot: DagSnapshot): string {
    const elements = {
      nodes: snapshot.nodes.map(node => ({ data: { id: node.taskId, label: node.taskId, layer: node.layer, priority: node.priority, parallelGroup: node.parallelGroup, critical: node.isCriticalPath } })),
      edges: snapshot.edges.map((edge, index) => ({ data: { id: `${edge.from}->${edge.to}:${index}`, source: edge.from, target: edge.to, condition: edge.condition } }))
    }
    return `${JSON.stringify({ elements, layout: { name: 'dagre', rankDir: 'TB' } }, null, 2)}\n`
  }

  private mermaidId(taskId: string): string {
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(taskId)) return taskId
    return `N_${this.hash(taskId)}`
  }

  private hash(value: string): string {
    let hash = 0
    for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0
    return hash.toString(16)
  }

  private escapeMermaidLabel(value: string): string {
    return value.replaceAll('"', '\\"')
  }

  private escapeDot(value: string): string {
    return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  }
}
