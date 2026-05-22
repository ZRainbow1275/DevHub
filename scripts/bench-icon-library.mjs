import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import react from '@vitejs/plugin-react'
import { build } from 'vite'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entry = 'src/renderer/components/icon/registry.tsx'
const bundleBudgetBytes = 200 * 1024
const iconLibraries = [
  'lucide-react',
  '@tabler/icons-react',
  '@radix-ui/react-icons',
  '@heroicons/react/24/outline',
  '@icons-pack/react-simple-icons',
]

const source = await readFile(resolve(rootDir, entry), 'utf8')
const namespaceImports = iconLibraries.filter((libraryName) => {
  const escapedLibraryName = libraryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+['"]${escapedLibraryName}['"]`).test(source)
})

if (namespaceImports.length > 0) {
  throw new Error(`Icon registry must use explicit named imports for tree-shaking: ${namespaceImports.join(', ')}`)
}

const buildResult = await build({
  root: rootDir,
  logLevel: 'silent',
  plugins: [react()],
  build: {
    write: false,
    minify: true,
    sourcemap: false,
    lib: {
      entry,
      formats: ['es'],
      fileName: 'icon-registry',
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime'],
      output: {
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})

const outputs = Array.isArray(buildResult) ? buildResult.flatMap((result) => result.output) : buildResult.output
const chunks = outputs.filter((output) => output.type === 'chunk')
const assets = outputs.filter((output) => output.type === 'asset')
const code = chunks.map((chunk) => chunk.code).join('\n')
const rawBytes = Buffer.byteLength(code, 'utf8')
const gzipBytes = gzipSync(code).length

if (rawBytes > bundleBudgetBytes) {
  throw new Error(`Icon registry bundle ${rawBytes} bytes exceeds ${bundleBudgetBytes} byte budget`)
}

console.log(JSON.stringify({
  entry,
  chunks: chunks.length,
  assets: assets.length,
  rawBytes,
  gzipBytes,
  rawKb: Number((rawBytes / 1024).toFixed(2)),
  gzipKb: Number((gzipBytes / 1024).toFixed(2)),
  bundleBudgetKb: bundleBudgetBytes / 1024,
  namespaceImports,
}, null, 2))
