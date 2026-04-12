# Code Style and Conventions

## TypeScript
- Strict mode enabled (`strict: true` in tsconfig)
- `noUnusedLocals: true`, `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `forceConsistentCasingInFileNames: true`
- Target: ES2022, Module: ESNext, Module Resolution: bundler
- `@typescript-eslint/no-explicit-any: error` — `any` is forbidden

## ESLint Rules
- Flat config (eslint.config.js), ESLint 9 + typescript-eslint
- `react/react-in-jsx-scope: off` (React 17+ JSX transform)
- `react/prop-types: off` (TypeScript handles prop validation)
- `react-hooks/rules-of-hooks: error`
- `react-hooks/exhaustive-deps: warn`
- Unused vars: warn (prefix with `_` to ignore)
- `no-console: warn` (only `console.warn` and `console.error` allowed)

## Naming Conventions
- Files: PascalCase for React components (e.g., `App.tsx`), camelCase for utilities
- TypeScript: Strict types, shared types in `src/shared/types.ts`
- Path aliases: Use `@main/`, `@renderer/`, `@shared/` instead of relative paths

## React Patterns
- Functional components only
- State management via Zustand stores (`src/renderer/stores/`)
- Custom hooks in `src/renderer/hooks/`
- TailwindCSS for styling

## Platform
- Development on Windows (Git Bash shell)
- Electron for desktop deployment
- pnpm as package manager (workspace mode)
