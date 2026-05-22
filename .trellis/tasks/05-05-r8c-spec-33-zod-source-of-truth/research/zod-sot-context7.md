# Zod SoT Research Notes

## Source

- Context7 `/colinhacks/zod/v3.24.2`, queried on 2026-05-05 for TypeScript schema single-source, `z.infer`, `safeParse`, and IPC boundary validation.

## Findings Applied

- Define runtime object schemas first, then derive TypeScript types with `z.infer<typeof schema>` to avoid parallel type definitions.
- Use `schema.parse(...)` at trusted hard boundaries when invalid input should stop execution.
- Use `schema.safeParse(...)` for diagnostic and UI-facing validation flows where the caller needs structured errors instead of thrown exceptions.
- Convert Zod issues into explicit path/message pairs for renderer-safe error display and audit logging.

## Implementation Implication

- `SchemaRegistry` should hold actual Zod schema objects from the runtime registry, not string-only metadata.
- `IpcSchemaGuard` should offer both throwing `parseRequest/parseResponse` and non-throwing `safeValidate` paths.
- `zod:validate-payload` should use `safeParse` and return issue details, while production handlers can continue using `parse` for strict boundary enforcement.
