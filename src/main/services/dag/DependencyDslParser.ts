import { dependencyConditionSchema, parsedDependencySchema, type DependencyClause, type ParsedDependency } from '@shared/schemas/dag'

export class DependencyDslParser {
  parse(rawDependency: string | null | undefined): ParsedDependency {
    const raw = (rawDependency ?? '').trim()
    if (!raw) return parsedDependencySchema.parse({ raw, clauses: [] })

    const segments = raw.split(';').map(segment => segment.trim()).filter(Boolean)
    const clauses = segments.flatMap(segment => this.parseSegment(segment, raw))
    return parsedDependencySchema.parse({ raw, clauses })
  }

  fromDependencyIds(dependencyIds: readonly string[]): ParsedDependency {
    const refs = dependencyIds.map(ref => ref.trim()).filter(Boolean)
    if (refs.length === 0) return parsedDependencySchema.parse({ raw: '', clauses: [] })
    return parsedDependencySchema.parse({
      raw: refs.join(','),
      clauses: [{ refs, combinator: 'all', condition: 'success' }]
    })
  }

  private parseSegment(segment: string, raw: string): DependencyClause[] {
    if (!segment.startsWith('after:')) {
      const refs = this.parseRefs(segment, ',')
      return refs.length === 0 ? [] : [{ refs, combinator: 'all', condition: 'success' }]
    }

    const match = /^after:(?<refs>[^\s]+)(?:\s+if=(?<condition>[a-z]+))?$/.exec(segment)
    if (!match?.groups) {
      throw new Error(`E_VALIDATION:invalid dependency DSL "${raw}"; expected after:T1, after:T1 if=success, or after:T1|T2 if=any`)
    }

    const refText = match.groups.refs
    const conditionText = match.groups.condition ?? 'success'
    const condition = dependencyConditionSchema.safeParse(conditionText)
    if (!condition.success) {
      throw new Error(`E_VALIDATION:invalid dependency condition "${conditionText}" in "${raw}"`)
    }

    const hasAnySeparator = refText.includes('|')
    const separator = hasAnySeparator ? '|' : ','
    const refs = this.parseRefs(refText, separator)
    if (refs.length === 0) {
      throw new Error(`E_VALIDATION:dependency DSL "${raw}" does not reference any taskId`)
    }

    return [{ refs, combinator: hasAnySeparator ? 'any' : 'all', condition: condition.data }]
  }

  private parseRefs(refText: string, separator: ',' | '|'): string[] {
    return refText.split(separator).map(ref => ref.trim()).filter(Boolean)
  }
}
