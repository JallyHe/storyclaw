import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const copyElectronAssets = () => ({
  name: 'copy-electron-assets',
  closeBundle: async () => {
    const fs = await import('fs/promises')
    await fs.cp(resolve('electron/assets'), resolve('out/assets'), { recursive: true })
  }
})

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: resolve('electron/main.ts')
      }
    },
    plugins: [externalizeDepsPlugin({
      exclude: [
        '@earendil-works/pi-coding-agent',
        '@earendil-works/pi-agent-core',
        '@earendil-works/pi-ai',
        '@earendil-works/pi-tui',
        'chalk',
        'diff',
        'glob',
        'highlight.js',
        'ignore',
        'jiti',
        'minimatch',
        'typebox',
        'undici',
        'yaml'
      ]
    }), copyElectronAssets()],
    resolve: {
      alias: {
        '@main': resolve('electron'),
        'node:sqlite': resolve('electron/shims/node-sqlite.ts'),
        'undici': resolve('electron/shims/undici.ts')
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve('electron/preload.ts')
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: '.',
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true
    },
    build: {
      rollupOptions: {
        input: resolve('index.html')
      }
    },
    resolve: {
      alias: {
        '@': resolve('src'),
        'path': 'path-browserify'
      }
    },
    plugins: [react()]
  }
})
