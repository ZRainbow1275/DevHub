import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          'watchdog-process/main': resolve(__dirname, 'src/watchdog-process/main.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@main': resolve(__dirname, 'src/main'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['zod'] })],
    build: {
      lib: {
        entry: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          monitor: resolve(__dirname, 'src/preload/monitor.ts'),
          'port-popout': resolve(__dirname, 'src/preload/port-popout.ts'),
          'monitor-popout': resolve(__dirname, 'src/preload/monitor-popout.ts')
        },
        formats: ['cjs'],
        fileName: (_format, entryName) => `${entryName}.cjs`
      },
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          monitor: resolve(__dirname, 'src/preload/monitor.ts'),
          'port-popout': resolve(__dirname, 'src/preload/port-popout.ts'),
          'monitor-popout': resolve(__dirname, 'src/preload/monitor-popout.ts')
        },
        output: {
          entryFileNames: '[name].cjs'
        }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  },
  renderer: {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      fs: {
        allow: [resolve(__dirname, '..')]
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          monitor: resolve(__dirname, 'src/renderer/monitor.html'),
          'port-popout': resolve(__dirname, 'src/renderer/port-popout.html'),
          'monitor-popout': resolve(__dirname, 'src/renderer/monitor-popout.html')
        }
      }
    }
  }
})
