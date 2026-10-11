// FR-M-02/07·NFR-08: development-only classic bundle; SDK importScripts needs classic scope.
import { fileURLToPath } from 'node:url'
import { build, type Plugin } from 'vite'
import { SDK_DEV_POLICY } from './sdk-network-policy.ts'

export function devInferenceWorkerPlugin(): Plugin {
  return {
    name: 'bodyguard-development-inference-worker',
    apply: 'serve',
    configureServer(server) {
      const root = fileURLToPath(new URL('../', import.meta.url))
      let bundle: Promise<string> | undefined
      const invalidate = (file: string) => {
        if (file.startsWith(`${root}src/`)) bundle = undefined
      }
      server.watcher.on('change', invalidate)
      server.httpServer?.once('close', () => server.watcher.off('change', invalidate))
      async function compile() {
        const result = await build({
          configFile: false,
          root,
          envDir: false,
          publicDir: false,
          logLevel: 'error',
          build: {
            write: false,
            emptyOutDir: false,
            copyPublicDir: false,
            minify: false,
            lib: {
              entry: fileURLToPath(
                new URL('../src/pose/nativeInference.worker.ts', import.meta.url),
              ),
              name: 'BodyguardInferenceWorker',
              formats: ['iife'],
            },
          },
        })
        const outputs = Array.isArray(result) ? result : [result]
        const chunk = outputs
          .flatMap((item) => ('output' in item ? item.output : []))
          .filter((item) => item.type === 'chunk')
        if (chunk.length !== 1) throw new Error('Development inference bundle unavailable')
        return chunk[0].code
      }
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/__bodyguard/inference-worker.js') return next()
        if (!['GET', 'HEAD'].includes(req.method ?? '')) {
          res.statusCode = 405
          res.end()
          return
        }
        bundle ??= compile()
        const requested = bundle
        res.setHeader('Content-Type', 'application/javascript')
        res.setHeader('Content-Security-Policy', SDK_DEV_POLICY)
        res.setHeader('Cache-Control', 'no-store')
        void requested
          .then((code) => {
            if (res.destroyed) return
            res.end(req.method === 'HEAD' ? undefined : code)
          })
          .catch(() => {
            if (bundle === requested) bundle = undefined
            if (res.destroyed) return
            res.statusCode = 503
            res.setHeader('Content-Type', 'application/javascript')
            res.setHeader('Cache-Control', 'no-store')
            res.end('throw new Error("Development inference unavailable")')
          })
      })
    },
  }
}
