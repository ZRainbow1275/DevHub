# Suggested Commands

All commands should be run from the `devhub/` directory.

## Development
```bash
cd devhub && pnpm dev          # Start dev server (electron-vite dev)
cd devhub && pnpm build        # Build for production
cd devhub && pnpm preview      # Preview production build
```

## Testing
```bash
cd devhub && pnpm test         # Run unit tests (vitest)
cd devhub && pnpm test:ui      # Run tests with UI
cd devhub && pnpm test:coverage # Run tests with coverage
cd devhub && pnpm test:e2e     # Run e2e tests (playwright)
```

## Code Quality
```bash
cd devhub && pnpm lint         # Run ESLint
cd devhub && pnpm typecheck    # Run TypeScript type checking (tsc --noEmit)
```

## Packaging
```bash
cd devhub && pnpm package      # Build & package with electron-builder
cd devhub && pnpm package:win  # Package for Windows specifically
```

## System Utilities
```bash
git status                     # Check working tree status
git log --oneline -10          # Recent commits
git diff                       # View changes
ls -la                         # List files (Git Bash)
```
