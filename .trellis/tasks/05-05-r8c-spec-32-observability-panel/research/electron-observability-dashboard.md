# Electron Observability Dashboard Research

## Source

- Grok Search MCP query: `Electron React observability dashboard IPC rate limit telemetry best practices`
- Source session: `c6bfcab46a4e`
- External references returned by Grok included Electron performance/security guidance and Electron architecture articles. The implementation must still follow local DevHub style and spec-32 contracts.

## Practical Findings Applied

- Keep IPC async and expose only aggregated, validated data through `contextBridge`.
- Aggregate metrics in the main process to avoid renderer-side privileged access and avoid leaking raw process details.
- Track IPC call volume, rate-limit rejection counts, latency/resource metrics, and health issues as local metrics.
- Rate-limit or bound telemetry itself. Use a bounded ring buffer and subscription limits to avoid observability becoming a load source.
- Keep dashboards focused: overview health, metric cards, trends, and drill-down/export affordances are enough for this slice.
- Do not add remote telemetry SDKs for this project because spec-32 explicitly requires local-only `NO-TELEMETRY`.
